# Hướng dẫn cấu hình GitHub App và webhook

Tài liệu này hướng dẫn từng bước kết nối GitHub Pull Request với service tại `https://management.chungxanhla.name.vn`.

Sau khi hoàn tất, GitHub sẽ gọi webhook khi Pull Request được mở, cập nhật, mở lại hoặc đóng. Service đọc file thay đổi, tạo/cập nhật task và phát cập nhật realtime lên giao diện.

## 1. Hai thông tin bí mật cần dùng

| Biến | Công dụng | Nguồn |
| --- | --- | --- |
| `GITHUB_WEBHOOK_SECRET` | Xác minh request thực sự do GitHub gửi | Tự tạo bằng OpenSSL |
| `GITHUB_API_TOKEN` | Đọc file PR và đăng comment | Fine-grained Personal Access Token |

Không dùng cùng một chuỗi cho hai biến và không commit chúng lên Git. GitHub App hiện chịu trách nhiệm gửi webhook; service chưa tự sinh Installation Access Token từ App ID/private key nên vẫn cần `GITHUB_API_TOKEN`.

## 2. Kiểm tra domain

```bash
curl -i https://management.chungxanhla.name.vn/health
```

Kết quả đúng là HTTP `200` với body:

```json
{"status":"ok"}
```

Kiểm tra route webhook:

```bash
curl -i -X POST \
  -H "Content-Type: application/json" \
  --data '{}' \
  https://management.chungxanhla.name.vn/webhooks/github
```

Kết quả mong đợi là `401 Unauthorized` và `Invalid signature`. Điều này chứng minh request đã qua Cloudflare/Nginx và đến service, nhưng bị từ chối vì lệnh thử không có chữ ký GitHub.

## 3. Tạo webhook secret trên VPS

SSH vào VPS:

```bash
openssl rand -hex 32
```

Lưu kết quả trong trình quản lý mật khẩu. Tài liệu gọi chuỗi này là `WEBHOOK_SECRET_CUA_BAN`.

Thêm vào file `.env` mà Docker Compose sử dụng:

```env
GITHUB_WEBHOOK_SECRET=WEBHOOK_SECRET_CUA_BAN
```

Không thêm dấu nháy hoặc khoảng trắng quanh dấu `=`.

## 4. Tạo GitHub App

1. Đăng nhập GitHub bằng tài khoản quản trị repository/organization.
2. Nhấn ảnh đại diện → **Settings**.
3. Chọn **Developer settings**.
4. Chọn **GitHub Apps**.
5. Nhấn **New GitHub App**.

Điền:

| Trường | Giá trị |
| --- | --- |
| GitHub App name | `Chung Xanh La Project Management` hoặc tên duy nhất khác |
| Description | `Synchronize GitHub pull requests with Project Management` |
| Homepage URL | `https://management.chungxanhla.name.vn/` |

Các mục không dùng:

- Callback URL: để trống.
- Request user authorization during installation: tắt.
- Enable Device Flow: tắt.
- Setup URL: để trống.

## 5. Cấu hình webhook

Trong phần **Webhook**:

| Trường | Giá trị |
| --- | --- |
| Active | Bật |
| Webhook URL | `https://management.chungxanhla.name.vn/webhooks/github` |
| Webhook secret | Chính xác `WEBHOOK_SECRET_CUA_BAN` |
| SSL verification | Enable SSL verification |

Webhook URL không có dấu `/` cuối.

## 6. Cấu hình quyền tối thiểu

Trong **Repository permissions**:

| Permission | Chỉ đọc PR | Bot đăng comment |
| --- | --- | --- |
| Metadata | Read-only | Read-only |
| Pull requests | Read-only | Read and write |

Các quyền khác giữ `No access`. Nếu tùy chọn **Post review comment** trong Project Management đang bật, token phải có quyền ghi Pull Request. Nếu không cần bot bình luận, tắt tùy chọn đó và chỉ cấp quyền đọc.

## 7. Chọn event

Trong **Subscribe to events**, chỉ chọn:

```text
Pull request
```

Service xử lý các action:

```text
opened
reopened
synchronize
closed
```

Không cần chọn Push, Issues, Pull request review hoặc Workflow run.

Tại **Where can this GitHub App be installed?**, chọn `Only on this account` nếu dùng nội bộ. Nhấn **Create GitHub App**.

## 8. Cài App vào repository

1. Vào trang App vừa tạo.
2. Chọn **Install App**.
3. Nhấn **Install** cạnh tài khoản/organization.
4. Chọn **Only select repositories**.
5. Chọn repository cần đồng bộ.
6. Nhấn **Install**.

Khi thêm repository mới, quay lại installation và cấp thêm quyền truy cập.

## 9. Tạo Fine-grained Personal Access Token

1. GitHub → **Settings** → **Developer settings**.
2. **Personal access tokens** → **Fine-grained tokens**.
3. Chọn **Generate new token**.
4. Token name: `project-management-vps`.
5. Chọn thời hạn và ghi lịch xoay token.
6. Resource owner: tài khoản/organization sở hữu repository.
7. Repository access: **Only select repositories** và chọn đúng repository.
8. Repository permissions:
   - Metadata: Read-only.
   - Pull requests: Read-only; hoặc Read and write nếu đăng comment.
9. Tạo và sao chép token ngay.

Thêm vào `.env` VPS:

```env
GITHUB_API_TOKEN=github_pat_xxxxxxxxxxxxxxxxx
```

Không dán Installation Access Token thủ công vì loại token đó hết hạn nhanh.

## 10. Giới hạn repository và action

Một repository:

```env
ALLOWED_REPOSITORIES=chunga00d1-code/ten-repository
```

Nhiều repository:

```env
ALLOWED_REPOSITORIES=chunga00d1-code/repo-one,chunga00d1-code/repo-two
```

Tên phải đúng dạng `owner/repository`, không dùng URL hoặc hậu tố `.git`.

Phần GitHub hoàn chỉnh trong `.env`:

```env
GITHUB_WEBHOOK_SECRET=WEBHOOK_SECRET_CUA_BAN
GITHUB_API_TOKEN=github_pat_xxxxxxxxxxxxxxxxx
PULL_REQUEST_ACTIONS=opened,reopened,synchronize,closed
ALLOWED_REPOSITORIES=chunga00d1-code/ten-repository
```

## 11. Áp dụng cấu hình vào container

Restart thông thường có thể không nạp lại environment; cần recreate:

```bash
docker compose pull
docker compose up -d --force-recreate project-management
```

Kiểm tra:

```bash
docker ps --filter name=project-management-develop
docker logs --tail 100 project-management-develop
curl -i https://management.chungxanhla.name.vn/health
```

Không chia sẻ toàn bộ output `docker inspect` công khai vì environment có thể chứa secret.

## 12. Kiểm tra ping delivery

1. GitHub → **Settings → Developer settings → GitHub Apps**.
2. Chọn App vừa tạo.
3. Chọn **Advanced**.
4. Xem **Recent deliveries**.
5. Mở delivery `ping`.

Kết quả đúng:

```text
Response status: 200
```

```json
{"message":"pong"}
```

Sau khi sửa lỗi, có thể mở delivery cũ và nhấn **Redeliver**.

## 13. Kiểm tra Pull Request thực tế

1. Tạo branch mới trong repository đã cài App.
2. Thay đổi một file và push branch.
3. Mở Pull Request.
4. Mở GitHub App → **Advanced → Recent deliveries**.
5. Chọn delivery `pull_request`, action `opened`.

Response thành công có dạng:

```json
{
  "received": true,
  "findings": 0,
  "status": "ready"
}
```

Đăng nhập Project Management và kiểm tra task tương ứng. Push thêm commit vào PR sẽ tạo action `synchronize`; task phải cập nhật realtime.

Theo dõi log VPS khi thử:

```bash
docker logs -f project-management-develop
```

## 14. Cloudflare và Nginx

Cloudflare không được cache hoặc đặt Zero Trust Login trước webhook. Nếu có Cache Rule, tạo bypass:

```text
URI Path starts with /webhooks/github
Cache eligibility: Bypass cache
```

Nginx chỉ cần proxy HTTP thông thường:

```nginx
location /webhooks/github {
    proxy_pass http://127.0.0.1:2000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
    client_max_body_size 2m;
}
```

Không cần WebSocket cho webhook. Realtime giao diện dùng SSE và có cấu hình riêng tại `deploy/nginx-realtime.conf.example`.

Sau khi sửa Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 15. Xử lý lỗi thường gặp

| Kết quả | Nguyên nhân | Cách xử lý |
| --- | --- | --- |
| `200 pong` | Ping hợp lệ | Không cần xử lý |
| `200 received` | PR đã xử lý | Kiểm tra task trên giao diện |
| `202 ignored` | Event/action không xử lý | Kiểm tra event và `PULL_REQUEST_ACTIONS` |
| `202 repository_not_allowed` | Repo ngoài allowlist | Sửa `ALLOWED_REPOSITORIES`, recreate container |
| `401 Invalid signature` | Secret không khớp | Sửa secret, recreate, redeliver |
| `GitHub files HTTP 401` | PAT sai/hết hạn | Cập nhật `GITHUB_API_TOKEN` |
| `GitHub files HTTP 403` | PAT thiếu quyền/repository | Sửa Repository access và quyền Pull requests |
| `GitHub comment HTTP 403` | Token chỉ có quyền đọc | Cấp Read and write hoặc tắt Post review comment |
| `404` | URL sai | Dùng đúng `/webhooks/github` |
| `413` | Giới hạn body | Đặt `client_max_body_size 2m` hoặc lớn hơn |
| `502/504` | Nginx không tới container | Kiểm tra container, port 2000 và upstream |
| Timeout | Firewall/Cloudflare Access/DNS | Kiểm tra public route và Cloudflare rules |

## 16. Checklist hoàn tất

- [ ] `/health` trả `200`.
- [ ] Đã tạo webhook secret ngẫu nhiên.
- [ ] `GITHUB_WEBHOOK_SECRET` đã đặt trên VPS.
- [ ] GitHub App có đúng Webhook URL.
- [ ] SSL verification được bật.
- [ ] App chỉ subscribe Pull request.
- [ ] App được cài đúng repository.
- [ ] Fine-grained PAT có quyền phù hợp.
- [ ] `GITHUB_API_TOKEN` đã đặt trên VPS.
- [ ] `ALLOWED_REPOSITORIES` đúng định dạng.
- [ ] Container đã được recreate.
- [ ] Ping delivery trả `200 pong`.
- [ ] PR delivery trả `200 received`.
- [ ] Task xuất hiện/cập nhật realtime.

## Tài liệu GitHub chính thức

- [Registering a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)
- [Installing your own GitHub App](https://docs.github.com/en/apps/using-github-apps/installing-your-own-github-app)
- [Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- [Validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
