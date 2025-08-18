# Руководство по настройке HTTPS и сертификатов (iPhone + локальная сеть)

Цель: запустить FinStat по адресу `https://finstat.test` с рабочим FaceID/WebAuthn на iPhone.

Состав:
- Домен: `finstat.test`
- DNS: MikroTik раздает локальную запись `finstat.test → <LAN_IP>`
- Сертификаты: `mkcert` (локальный доверенный корень + серверный сертификат)
- Контейнеры: порты `80:80` и `443:443`, папка `./certs` монтируется в `/etc/nginx/certs`

Важно: на iPhone WebAuthn/FaceID не работает на IP/localhost. Нужен домен + HTTPS, корневой сертификат должен быть установлен и доверен на iPhone.

---

## 1) Предпосылки
- Windows (PowerShell), установлен Docker/Docker Compose
- Доступ к MikroTik (WinBox/WebFig/CLI)
- Локальный IP сервера с проектом, напр.: `<LAN_IP> = 192.168.88.156`

Пути в проекте:
- Сертификаты: `./certs/server.crt` (fullchain) и `./certs/server.key`
- Nginx: `nginx.conf` (установлен `server_name finstat.test`, редирект 80 → 443)
- Сопоставление портов: в `docker-compose.yml` — `80:80` и `443:443`, монтирование `./certs:/etc/nginx/certs:ro`

---

## 2) Настройка DNS на MikroTik
Чтобы iPhone резолвил `finstat.test` в ваш `<LAN_IP>`.

Вариант A — WinBox/WebFig:
- IP → DNS:
  - Включить «Allow Remote Requests»
  - Указать апстрим DNS (напр., `1.1.1.1` и `8.8.8.8`)
- IP → DNS → Static → Add:
  - Name: `finstat.test`
  - Address: `<LAN_IP>` (например, `192.168.88.156`)
  - TTL: `1d`
- IP → DHCP Server → Networks → открыть вашу сеть (напр., `192.168.88.0/24`) и в DNS Servers указать IP роутера (обычно `192.168.88.1`).
- На iPhone выключить/включить Wi‑Fi или «Обновить аренду».

Вариант B — CLI (RouterOS v7/v6):
```bash
/ip dns set allow-remote-requests=yes servers=1.1.1.1,8.8.8.8
/ip dns static add name=finstat.test address=<LAN_IP> ttl=1d
/ip dns cache flush
/ip dhcp-server network set [find] dns-server=192.168.88.1
```
Проверка на роутере:
```bash
/resolve name=finstat.test
```
Должен вернуть `<LAN_IP>`.

---

## 3) Установка и подготовка mkcert (Windows)
Устанавливаем локальный корневой сертификат (Root CA) и делаем его доверенным на ПК.

```powershell
choco install mkcert -y
mkcert -install
# показать папку корневого сертификата
mkcert -CAROOT
```

Откройте указанную папку, там будет `rootCA.pem`.

---

## 4) Установка корневого сертификата mkcert на iPhone
- Передайте на iPhone файл `rootCA.pem` (можно переименовать в `rootCA.cer` или сконвертировать в DER):
```powershell
openssl x509 -in rootCA.pem -out rootCA.cer -outform der
```
- Установите профиль на iPhone, затем включите доверие: Настройки → Основные → Об этом устройстве → Доверие сертификатам → включить «Полное доверие» для установленного корня.

Без этого шага Safari будет ругаться на сертификат.

---

## 5) Выпуск серверного сертификата для `finstat.test`
Сгенерируйте сертификаты сразу в папку проекта `./certs`.

```powershell
cd C:\Users\Admin\Desktop\Product\fin_stat
mkdir certs 2>$null
mkcert -cert-file certs/server.crt -key-file certs/server.key finstat.test <LAN_IP>
# пример: mkcert -cert-file certs/server.crt -key-file certs/server.key finstat.test 192.168.88.156
```

Требования:
- `server.crt` должен содержать полную цепочку (fullchain)
- `server.key` — приватный ключ (никому не передавать)

Папка `./certs` уже монтируется контейнером в `/etc/nginx/certs` (только чтение).

---

## 6) Перезапуск контейнеров
```powershell
docker compose up -d --build
```
Проверьте логи Nginx при необходимости:
```powershell
docker logs -f finstat-app | cat
```

---

## 7) Проверки
1) На ПК:
```powershell
curl -vk https://finstat.test
```
Должен вернуться HTML SPA, CN/SAN сертификата должен включать `finstat.test`.

2) На iPhone:
- Выключите/включите Wi‑Fi (обновится DNS)
- Откройте `https://finstat.test`
- Лицензия доверена? Если нет — проверьте шаг 4

3) Редирект:
- Откройте `http://finstat.test` → должен редиректить на `https://finstat.test`

---

## 8) Разбор типичных проблем
- «Safari не удается найти сервер» → DNS не настроен на iPhone. Убедитесь, что роутер раздает себя как DNS, и есть статическая запись `finstat.test → <LAN_IP>`.
- «Небезопасное соединение/предупреждение о сертификате» → корневой `mkcert` не установлен/не доверен на iPhone. Повторите шаг 4.
- «Домен не совпадает» → сертификат выпущен не на `finstat.test`. Повторите шаг 5 с нужным именем.
- «TLS ClientHello на 80 порту и 400 в логах» → открываете `https://` на порту 80. Используйте чистый домен (мы включили редирект 80→443) и проверьте, что проброшен 443 (`docker-compose.yml`).
- «Цепочка не полная» → `server.crt` должен быть fullchain. Для mkcert обычно ок, для LE используйте `fullchain.pem`.

---

## 9) Альтернатива для быстрой проверки (без локального DNS)
Можно использовать домен‑алияс по IP:
- Пример: `192-168-88-156.sslip.io` (замените IP на свой)
- Выпустите сертификат: `mkcert -cert-file certs/server.crt -key-file certs/server.key 192-168-88-156.sslip.io`
- Добавьте в `nginx.conf` оба имени:
  - `server_name finstat.test 192-168-88-156.sslip.io;`
- Откройте `https://192-168-88-156.sslip.io`

Это удобно для демо, но лучше настроить собственный DNS на роутере.

---

## 10) Полезные команды
```powershell
# Переустановка корня mkcert (если нужно полностью перевыпустить CA)
mkcert -uninstall
$env:CAROOT=(mkcert -CAROOT)
Remove-Item -Recurse -Force $env:CAROOT
mkcert -install

# Показать путь CAROOT
mkcert -CAROOT

# Проверить сертификат сайта
curl -vk https://finstat.test

# Перезапуск контейнеров
cd C:\Users\Admin\Desktop\Product\fin_stat
docker compose up -d --build
```

---

## 11) Резюме чек-листа
1. Добавьте DNS запись на MikroTik: `finstat.test → <LAN_IP>` и раздавайте DNS с роутера
2. Установите mkcert на ПК, установите Root CA
3. Установите Root CA на iPhone и включите «Полное доверие»
4. Выпустите `./certs/server.crt` и `./certs/server.key` для `finstat.test <LAN_IP>`
5. Перезапустите контейнеры, откройте `https://finstat.test` на iPhone

Никогда не делитесь `server.key`. Если требуется прод, используйте Let’s Encrypt (`fullchain.pem` → `server.crt`, `privkey.pem` → `server.key`).
