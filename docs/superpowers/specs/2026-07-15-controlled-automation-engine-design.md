# Controlled Automation Engine Design

## 1. Mục tiêu

Xây dựng một automation engine theo sự kiện để hệ thống tự xử lý nhiều công việc lặp lại trong ba nhóm nghiệp vụ:

- Luồng GitHub Pull Request.
- Quản lý task.
- Xử lý webhook, notification và background job thất bại.

Thiết kế phải cân bằng ba mục tiêu: giảm thao tác thủ công, phản ứng nhanh và giảm sai sót. Chỉ `superadmin` được cấu hình rule. Hành động an toàn có thể tự chạy; hành động nhạy cảm bắt buộc được duyệt trước. Khi execution thất bại, hệ thống tự rollback hoặc thực hiện hành động bù trừ.

## 2. Phạm vi

### Trong phạm vi phiên bản đầu

- Biểu mẫu tạo rule gồm trigger, điều kiện, action, chính sách phê duyệt và chính sách lỗi.
- Rule ở phạm vi toàn hệ thống, repository, project hoặc team.
- Rule versioning, bật/tắt, nhân bản, dry run và lịch sử thực thi.
- Xử lý sự kiện gần thời gian thực và sự kiện do scheduler phát sinh.
- Phê duyệt execution, retry, rollback, hành động bù trừ, audit và cảnh báo.
- Chống chạy trùng, chống vòng lặp và phục hồi an toàn sau khi worker khởi động lại.

### Ngoài phạm vi phiên bản đầu

- Script tùy ý.
- AI tự sinh và tự bật rule.
- Workflow lồng nhau.
- Marketplace chia sẻ rule.
- Quyền tạo rule theo project cho admin hoặc manager.

## 3. Kiến trúc

### Event Source

Chuẩn hóa sự kiện từ webhook GitHub, thay đổi task, scheduler và hệ thống vận hành thành một event envelope chung. Envelope chứa `eventId`, loại sự kiện, nguồn, thời điểm, actor, phạm vi và payload nghiệp vụ.

### Rule Engine

Tìm các rule đang bật theo loại trigger và phạm vi, sau đó đánh giá nhóm điều kiện `AND/OR`. Engine chỉ đọc phiên bản rule bất biến đã được publish.

### Execution Planner

Tạo snapshot kế hoạch thực thi trước khi chạy. Kế hoạch xác định thứ tự action, action cần duyệt, dữ liệu dự kiến thay đổi, retry policy và compensation action tương ứng.

### Approval Queue

Giữ execution ở trạng thái chờ khi kế hoạch chứa action nhạy cảm. Chỉ `superadmin` có thể duyệt, từ chối hoặc hủy. Giao diện phải hiển thị đầy đủ tác động dự kiến trước khi duyệt.

### Action Runner

Thực thi action theo thứ tự bằng worker bất đồng bộ. Mỗi action dùng idempotency key riêng, lưu attempt và chỉ chuyển sang thành công sau khi đã lưu kết quả cùng dữ liệu cần cho rollback.

### Rollback Coordinator

Khi một action hết retry mà vẫn lỗi, coordinator dừng các bước sau và bù trừ những action đã thành công theo thứ tự ngược. Với side effect bên ngoài, coordinator ưu tiên xóa hoặc chỉnh sửa; nếu API không hỗ trợ, hệ thống gửi thông báo đính chính và ghi audit.

### Audit & Monitoring

Lưu event đầu vào, rule version, kết quả điều kiện, kế hoạch, quyết định phê duyệt, từng attempt, kết quả rollback và lỗi. Trạng thái được đẩy lên frontend qua SSE hiện có.

MongoDB là nguồn trạng thái bền vững. Redis hỗ trợ phân phối công việc giữa nhiều instance nhưng không phải nguồn sự thật duy nhất.

## 4. Mô hình rule

Một rule gồm:

- Tên, mô tả, trạng thái và độ ưu tiên.
- Phạm vi: system, repository, project hoặc team.
- Thời gian hiệu lực tùy chọn.
- Một trigger.
- Cây điều kiện hỗ trợ nhóm `AND/OR`.
- Danh sách action có thứ tự.
- Approval policy.
- Failure policy gồm số lần retry, exponential backoff và execution timeout.
- Phiên bản bất biến và metadata người tạo/cập nhật.

Chỉ `superadmin` được tạo, sửa, publish, nhân bản, bật hoặc tắt rule. Việc sửa một rule đã publish tạo phiên bản mới; execution đang chạy tiếp tục dùng phiên bản cũ.

## 5. Trigger và action phiên bản đầu

### Trigger

- PR mở, cập nhật, merge, đóng hoặc thay đổi review.
- Task tạo mới, cập nhật, đổi trạng thái, sắp đến hạn hoặc quá hạn.
- Webhook, notification hoặc background job thất bại.
- Lịch định kỳ.

### Action

- Tạo hoặc cập nhật task.
- Đổi trạng thái, assignee, reviewer, priority hoặc label.
- Gửi thông báo nội bộ hoặc email.
- Bình luận hoặc cập nhật metadata GitHub.
- Retry job hoặc tạo cảnh báo vận hành.

Hệ thống duy trì action registry. Mỗi loại action phải khai báo schema cấu hình, mức nhạy cảm, hàm validate, hàm execute và chiến lược compensate. Action không có chiến lược bù trừ rõ ràng không được publish trong rule.

## 6. Chính sách phê duyệt

Các action sau bắt buộc phải duyệt:

- Xóa task hoặc thay đổi dữ liệu hàng loạt.
- Đổi assignee hoặc reviewer.
- Thay đổi trạng thái PR hoặc task quan trọng.
- Gửi bình luận hoặc thông báo ra GitHub.
- Chạy lại tác vụ đã thất bại nhiều lần.

Các action như gắn nhãn, tạo cảnh báo nội bộ, tính độ ưu tiên và retry lần đầu có thể tự chạy. Superadmin có thể yêu cầu duyệt thêm nhưng không thể hạ mức bảo vệ bắt buộc do action registry quy định.

Phê duyệt áp dụng cho toàn bộ execution plan trước khi action đầu tiên chạy. Vì vậy execution không tạo side effect một phần rồi mới chờ duyệt ở giữa luồng. Nếu kế hoạch thay đổi do dữ liệu nguồn đã lỗi thời, approval cũ mất hiệu lực và hệ thống phải tạo lại kế hoạch để duyệt lại.

## 7. Luồng thực thi

Mỗi cặp `eventId + ruleVersionId` chỉ được tạo một execution. Execution đi qua các trạng thái:

`planned → waiting_approval → running → succeeded`

Các nhánh kết thúc khác:

- `waiting_approval → rejected`
- `waiting_approval → cancelled`
- `waiting_approval → expired`
- `running → compensating → rolled_back`
- `running → compensating → compensation_failed`

Execution không cần duyệt chuyển trực tiếp từ `planned` sang `running`. Worker dùng lease có thời hạn để một execution chỉ được một worker xử lý tại một thời điểm. Khi worker chết, lease hết hạn và worker khác có thể tiếp tục từ trạng thái đã lưu.

## 8. Retry, rollback và bù trừ

Mỗi action có retry policy giới hạn và exponential backoff. Action chỉ được retry khi lỗi được phân loại là tạm thời. Validation error hoặc permission error chuyển thẳng sang rollback.

Khi rollback:

1. Dừng mọi action chưa chạy.
2. Lấy danh sách action đã thành công.
3. Chạy compensation theo thứ tự ngược.
4. Ghi kết quả riêng cho từng compensation attempt.
5. Chuyển sang `rolled_back` nếu tất cả thành công.
6. Chuyển sang `compensation_failed` và phát cảnh báo ưu tiên cao nếu có bước không thể bù trừ sau số lần thử cho phép.

Các side effect không thể xóa hoàn toàn, như email đã gửi, được bù trừ bằng thông báo đính chính có liên kết tới execution gốc. Người vận hành có thể retry riêng phần compensation thất bại; hệ thống không tự thử vô hạn.

## 9. Chống vòng lặp và chạy trùng

- Unique constraint trên `eventId + ruleVersionId` chống tạo execution trùng.
- Mỗi action attempt có idempotency key ổn định.
- Sự kiện do automation tạo ra chứa `automationExecutionId`, `sourceRuleId` và `automationDepth`.
- Một execution không được kích hoạt lại chính rule nguồn của nó.
- Chuỗi automation bị chặn khi vượt quá độ sâu cấu hình toàn hệ thống.
- Event đã xử lý vẫn được lưu đủ lâu để webhook hoặc job gửi lại không tạo side effect mới.

## 10. Dry run

Superadmin có thể chọn sự kiện mẫu hoặc execution cũ để chạy thử. Dry run:

- Đánh giá trigger, phạm vi và điều kiện.
- Tạo execution plan mô phỏng.
- Hiển thị thay đổi dự kiến, action cần duyệt và kế hoạch bù trừ.
- Không gọi adapter tạo side effect và không sửa dữ liệu nghiệp vụ.

Kết quả dry run được đánh dấu rõ là mô phỏng và không thể chuyển trực tiếp thành execution thật nếu chưa publish rule.

## 11. Giao diện quản trị

Khu vực Automation dành riêng cho `superadmin` gồm:

- Danh sách rule với trạng thái, phạm vi, phiên bản và lần chạy gần nhất.
- Trình tạo rule dạng biểu mẫu.
- Màn hình dry run.
- Approval Queue hiển thị tác động dự kiến và dữ liệu đã thay đổi kể từ lúc lập kế hoạch.
- Danh sách execution theo trạng thái.
- Timeline chi tiết của từng execution, gồm action attempts và compensation attempts.
- Cảnh báo `compensation_failed` và thao tác retry compensation.

## 12. Xử lý lỗi và quan sát hệ thống

- Lỗi được phân loại thành validation, permission, conflict, transient integration và permanent integration.
- Audit record là append-only; dữ liệu nhạy cảm phải được che trước khi lưu.
- Log có `eventId`, `ruleId`, `ruleVersionId`, `executionId` và `actionId` để truy vết.
- Dashboard hiển thị số execution chờ duyệt, đang chạy, thành công, rollback và compensation thất bại.
- Cảnh báo ưu tiên cao được tạo khi compensation thất bại hoặc queue bị tắc quá ngưỡng.

## 13. Kiểm thử

### Unit test

- Đánh giá cây điều kiện và phạm vi rule.
- Phân loại mức nhạy cảm của action.
- Lập kế hoạch, chuyển trạng thái và thứ tự compensation.
- Chống vòng lặp và tạo idempotency key.

### Integration test

- Unique execution khi event được giao nhiều lần.
- Worker lease và tiếp tục sau khi tiến trình khởi động lại.
- Approval, rejection, cancellation và expiration.
- Retry/backoff và rollback theo thứ tự ngược.
- MongoDB persistence và SSE status update.

### Contract test

- GitHub adapter.
- Email/notification adapter.
- Các adapter job vận hành.

### End-to-end test

- PR event tạo và cập nhật task.
- Task quá hạn tạo cảnh báo.
- Webhook lỗi được retry.
- Action nhạy cảm không chạy trước phê duyệt.
- Execution lỗi rollback thành công.
- Compensation thất bại tạo cảnh báo và cho phép retry thủ công.

## 14. Tiêu chí nghiệm thu

- Một sự kiện tạo tối đa một execution cho mỗi phiên bản rule.
- Chỉ `superadmin` truy cập và thay đổi rule hoặc quyết định phê duyệt.
- Action nhạy cảm không thể chạy khi chưa có phê duyệt hợp lệ cho execution plan hiện tại.
- Dry run không tạo side effect.
- Execution thất bại phải kết thúc ở `rolled_back` hoặc `compensation_failed`; không bị treo vô thời hạn.
- Audit cho phép truy ra event, rule version, quyết định phê duyệt, từng action và từng compensation.
- Worker có thể tiếp tục execution an toàn sau khi khởi động lại.
- Automation không làm mất hoặc chặn luồng xử lý thủ công hiện có.

