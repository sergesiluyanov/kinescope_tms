# Перенос TMS на другую VM (с HTTPS и доменом)

Гайд под сценарий «есть текущий прод на одной VM, нужно переехать на
другую, заодно подключив домен и HTTPS». Допускается короткий
даунтайм 10–20 минут.

## 0. Минимальные требования к новой VM

- Ubuntu 22.04 LTS или новее, минимум 2 vCPU / 2 GB RAM / 20 GB диска.
- Публичный IPv4.
- Открытые порты наружу: 22 (SSH), 80 (HTTP — для Let's Encrypt), 443 (HTTPS).
- Постгрес и API наружу не публикуются — они внутри docker-сети.

## 1. Подготовка СТАРОЙ VM: бэкап БД и `.env`

Заходим на старую VM:

```bash
ssh -i ~/.ssh/cloudru_tms admin@<СТАРЫЙ_IP>
cd ~/kinescope_tms
```

Снимаем дамп Postgres (плотный custom-формат `-Fc`, не SQL-текст —
быстрее, меньше, удобнее восстанавливать):

```bash
docker exec tms-postgres pg_dump -U tms -d kinescope_tms -Fc \
  > ~/kinescope_tms_$(date +%F).dump
ls -lh ~/kinescope_tms_*.dump
```

Сохраняем `.env` (там пароли и `JWT_SECRET` — без них API не поднимется):

```bash
cp ~/kinescope_tms/.env ~/kinescope_tms.env.backup
```

Качаем оба файла к себе на ноутбук (с локальной машины):

```bash
scp -i ~/.ssh/cloudru_tms admin@<СТАРЫЙ_IP>:~/kinescope_tms_*.dump .
scp -i ~/.ssh/cloudru_tms admin@<СТАРЫЙ_IP>:~/kinescope_tms.env.backup .
```

> Если дамп больше нескольких сотен мегабайт — лучше копировать его
> напрямую между VM, минуя ноутбук:
> ```bash
> ssh -i ~/.ssh/cloudru_tms admin@<СТАРЫЙ_IP> \
>     "cat ~/kinescope_tms_*.dump" \
>   | ssh admin@<НОВЫЙ_IP> "cat > ~/kinescope_tms.dump"
> ```

## 2. Подготовка НОВОЙ VM: Docker, Git, репо

Заходим на новую VM:

```bash
ssh admin@<НОВЫЙ_IP>
```

Ставим Docker (официальный convenience-скрипт) и Git:

```bash
sudo apt-get update
sudo apt-get install -y git make curl ca-certificates

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Выходим и заходим заново, чтобы группа `docker` применилась:

```bash
exit
ssh admin@<НОВЫЙ_IP>
docker compose version   # должен вывести Compose v2.x
```

Клонируем репозиторий:

```bash
cd ~
git clone https://github.com/sergesiluyanov/kinescope_tms.git
cd kinescope_tms
```

Кладём ранее сохранённый `.env` и дамп БД:

```bash
# с локальной машины (если копировал на ноут)
scp kinescope_tms.env.backup admin@<НОВЫЙ_IP>:~/kinescope_tms/.env
scp kinescope_tms_*.dump     admin@<НОВЫЙ_IP>:~/

# на новой VM убеждаемся, что .env на месте
cat ~/kinescope_tms/.env | grep -E '^(JWT_SECRET|POSTGRES_PASSWORD|DATABASE_URL)='
```

В `.env` обязательно поменяй `CORS_ORIGINS`, чтобы туда попал новый
домен/IP:

```bash
sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=https://tms.example.com,http://<НОВЫЙ_IP>|" .env
```

## 3. Подъём стека и восстановление БД

Поднимаем prod-стек:

```bash
make prod-up
```

Дождись, пока контейнеры станут healthy:

```bash
docker compose -f docker-compose.prod.yml ps
# ожидание ~30–60 сек, postgres быстрее, api — после applied миграций
```

Алёмбик-миграции применятся автоматически в энтрипоинте api (создадут
пустые таблицы). После этого восстанавливаем данные **поверх**:

```bash
# 1) останавливаем api, чтобы он не дёргал БД во время restore
docker compose -f docker-compose.prod.yml stop api

# 2) очищаем свежесозданные пустые таблицы и заливаем дамп
docker exec -i tms-postgres psql -U tms -d kinescope_tms -c \
  "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

docker exec -i tms-postgres pg_restore -U tms -d kinescope_tms --no-owner \
  < ~/kinescope_tms_*.dump

# 3) поднимаем api обратно
docker compose -f docker-compose.prod.yml start api
```

Проверяем, что данные на месте:

```bash
docker exec -it tms-postgres psql -U tms -d kinescope_tms \
  -c "SELECT id, email, role FROM users ORDER BY id;"

docker exec -it tms-postgres psql -U tms -d kinescope_tms \
  -c "SELECT count(*) FROM projects, sections, test_cases;"
```

Открой `http://<НОВЫЙ_IP>/` — должен подняться UI, логин под старым
пользователем работать.

## 4. Подключение домена

В DNS-провайдере домена создаём A-запись:

```
tms.example.com   A   <НОВЫЙ_IP>   TTL=300
```

> TTL 300 (5 минут) на время переезда. После стабилизации можно
> поднять обратно до 3600.

Ждём, пока DNS прорастёт (5–15 мин), проверяем:

```bash
dig +short tms.example.com
# ожидаем <НОВЫЙ_IP>
```

## 5. HTTPS через Let's Encrypt (certbot в standalone-режиме)

Простой и надёжный путь — выпустить сертификат отдельно через
certbot и подмонтировать его в nginx-контейнер.

Ставим certbot на хосте:

```bash
sudo apt-get install -y certbot
```

Останавливаем nginx-контейнер, чтобы certbot мог занять 80 порт для
HTTP-01 challenge:

```bash
docker compose -f docker-compose.prod.yml stop web
```

Выпускаем сертификат:

```bash
sudo certbot certonly --standalone \
  -d tms.example.com \
  --email admin@kinescope.io \
  --agree-tos --no-eff-email
```

Результат лежит в `/etc/letsencrypt/live/tms.example.com/`. Файлы:
`fullchain.pem`, `privkey.pem`.

Дополняем `docker-compose.prod.yml`, чтобы пробросить сертификаты
внутрь контейнера web:

```yaml
  web:
    # ...
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
    ports:
      - "80:80"
      - "443:443"
```

Заменяем `frontend/nginx.conf` на HTTPS-конфигурацию:

```nginx
server {
  listen 80;
  server_name tms.example.com;
  # принудительный редирект на HTTPS, кроме Let's Encrypt
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 301 https://$host$request_uri; }
}

server {
  listen 443 ssl http2;
  server_name tms.example.com;

  ssl_certificate     /etc/letsencrypt/live/tms.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/tms.example.com/privkey.pem;

  # Современные настройки SSL (Mozilla Intermediate)
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers off;
  ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 1d;

  add_header Strict-Transport-Security "max-age=31536000" always;

  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://api:8000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

В `.env` обязательно выставить:

```
COOKIE_SECURE=true
CORS_ORIGINS=https://tms.example.com
```

Поднимаем стек обратно:

```bash
make prod-restart
```

Проверка:

```bash
curl -I https://tms.example.com
# ожидаем 200 OK, ниже строка Strict-Transport-Security
```

### Автопродление сертификата

Let's Encrypt-сертификаты живут 90 дней. Добавляем cron:

```bash
sudo crontab -e
# вставляем строку:
0 3 * * 1 certbot renew --pre-hook "docker compose -f /home/admin/kinescope_tms/docker-compose.prod.yml stop web" --post-hook "docker compose -f /home/admin/kinescope_tms/docker-compose.prod.yml start web"
```

> Проверять можно вручную: `sudo certbot renew --dry-run`.

## 6. Финальная проверка и переключение

1. Открой `https://tms.example.com/` в инкогнито. UI должен подняться,
   ты должен залогиниться существующим пользователем (его пароль
   переехал в дампе вместе со всем остальным).
2. Проверь, что свежие записи можно создавать: создай тестовый
   проект, удали его. Если ОК — переезд успешен.
3. На СТАРОЙ VM выруби контейнеры (но саму VM не удаляй ещё пару
   дней — на случай отката):

   ```bash
   ssh admin@<СТАРЫЙ_IP>
   cd ~/kinescope_tms
   docker compose -f docker-compose.prod.yml down
   ```

4. Через 1–2 дня, если всё ОК, выключи / удали старую VM в Cloud.ru.

## 7. Откат

Если что-то пошло не так — ничего страшного, у нас же остался старый
прод, который мы не удалили:

1. Подними контейнеры обратно на старой VM:

   ```bash
   ssh admin@<СТАРЫЙ_IP>
   cd ~/kinescope_tms
   make prod-restart
   ```

2. В DNS-провайдере поменяй A-запись `tms.example.com` обратно на
   `<СТАРЫЙ_IP>`.

Поскольку TTL мы поставили 300 секунд, переключение займёт 5–10 минут.

## Чек-лист переноса

- [ ] Снят дамп БД на старой VM (`pg_dump -Fc`)
- [ ] Скопирован `.env` со старой VM
- [ ] Новая VM создана, открыты порты 22/80/443
- [ ] На новой VM установлен Docker и Git
- [ ] Репо склонирован
- [ ] `.env` загружен
- [ ] Стек поднят (`make prod-up`)
- [ ] БД восстановлена из дампа (`pg_restore`)
- [ ] API проходит healthcheck
- [ ] UI открывается по IP
- [ ] DNS A-запись создана
- [ ] Сертификат Let's Encrypt выпущен
- [ ] `nginx.conf` обновлён под HTTPS
- [ ] `.env` обновлён (`COOKIE_SECURE=true`, `CORS_ORIGINS`)
- [ ] HTTPS открывается, логин работает
- [ ] Cron на автопродление сертификата настроен
- [ ] Старая VM остаётся включенной 1–2 дня для отката
