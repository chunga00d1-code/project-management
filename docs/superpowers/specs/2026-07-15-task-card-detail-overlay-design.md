# Thiết kế thẻ nhiệm vụ tối giản và popup chi tiết

## Mục tiêu

Thẻ nhiệm vụ chỉ hiển thị thông tin cần thiết, không tràn khỏi chiều rộng cột hoặc màn hình. Người dùng bấm vào bất kỳ vùng không tương tác nào của thẻ để mở đầy đủ nội dung nhiệm vụ. Popup chi tiết phải luôn nằm trên thanh tìm kiếm và bộ lọc.

## Thẻ nhiệm vụ

Mỗi thẻ chỉ hiển thị:

- Mã nhiệm vụ, nếu có.
- Tiêu đề, giới hạn tối đa hai dòng và rút gọn bằng dấu ba chấm khi dài hơn.
- Mức ưu tiên.
- Hạn xử lý, nếu có.
- Người phụ trách; tên dài được rút gọn an toàn và có nội dung đầy đủ qua thuộc tính `title`.

Không hiển thị trực tiếp trên thẻ các cảnh báo đồng bộ PR, mô tả, checklist, tiến độ checklist, bộ chọn trạng thái hay các nút xem/xóa. Trạng thái tiếp tục được nhận biết qua cột hoặc nhóm trạng thái và màu viền hiện có.

Toàn bộ thẻ hoạt động như một nút mở chi tiết, hỗ trợ chuột và bàn phím (`Enter`, `Space`). Trên desktop, khả năng kéo thả để đổi cột vẫn được giữ. Trên mobile, thẻ không kéo thả.

## Popup chi tiết

`TaskDetail` sử dụng cùng nền phủ và khung responsive với form tạo nhiệm vụ thay vì phần tử `dialog` cũ. Nền phủ dùng lớp xếp chồng cao hơn thanh lọc, toast và các thành phần sticky của trang.

Trên desktop, popup có chiều rộng tối đa phù hợp để đọc nội dung và chiều cao tối đa theo viewport; phần nội dung cuộn độc lập. Trên mobile, popup chiếm gần toàn màn hình, có vùng an toàn ở cạnh dưới và không bị tràn ngang.

Các thao tác đổi trạng thái, checklist, chỉnh sửa và xóa được thực hiện trong popup chi tiết. Đóng popup bằng nút đóng, phím Escape hoặc bấm nền phủ; khi đóng, focus trở về thẻ đã mở popup.

## Xử lý nội dung dài

Các phần tử trong thẻ dùng `min-width: 0`, quy tắc xuống dòng hoặc ellipsis phù hợp. Metadata được bố trí theo hàng có thể wrap nhưng không làm thẻ rộng hơn vùng chứa. Chuỗi không có khoảng trắng cũng phải ngắt an toàn.

## Kiểm thử

- Kiểm thử cấu trúc xác nhận thẻ chỉ còn năm nhóm thông tin cần thiết và không còn các điều khiển trạng thái/xóa.
- Kiểm thử xác nhận bấm thẻ và dùng bàn phím đều gọi hành động mở chi tiết.
- Kiểm thử xác nhận thẻ mobile vẫn không draggable.
- Kiểm thử overlay chi tiết có semantics modal, đóng bằng Escape và phục hồi focus.
- Chạy toàn bộ test, typecheck, lint và build trước khi hoàn tất.

## Ngoài phạm vi

- Không thay đổi API hoặc dữ liệu nhiệm vụ.
- Không thay đổi quy trình trạng thái.
- Không thiết kế lại nội dung nghiệp vụ bên trong trang chi tiết ngoài việc chuyển nó sang overlay responsive.
