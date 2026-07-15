# Responsive Task Page Design

## Mục tiêu

Tối ưu trang Nhiệm vụ cho màn hình nhỏ mà không thay đổi API hoặc hành vi Kanban desktop. Dưới 768px, task được trình bày thành danh sách nhóm theo trạng thái, filter dùng bottom sheet, còn create/detail/edit dùng sheet gần toàn màn hình.

## Phạm vi

Trong phạm vi:

- Responsive view cho trang Nhiệm vụ từ 320px trở lên.
- Mobile task list nhóm theo sáu trạng thái hiện có.
- Bottom-sheet filter có draft, apply, clear và badge.
- Responsive create/detail/edit overlay.
- Keyboard, focus, safe-area và reduced-motion behavior liên quan.
- Component và viewport tests.

Ngoài phạm vi:

- Thay đổi API, schema hoặc phân quyền.
- Thay đổi Kanban desktop và optimistic mutation hiện có.
- Drag/drop trên mobile.
- Responsive hóa các trang workspace khác.

## Breakpoint và chế độ hiển thị

- Mobile task view: viewport nhỏ hơn 768px.
- Desktop Kanban: viewport từ 768px trở lên.
- CSS chịu trách nhiệm về kích thước, spacing và hình dạng overlay.
- JavaScript dùng `matchMedia("(max-width: 767px)")` vì số lượng và loại component render thực sự thay đổi.
- Hook viewport phải theo dõi sự kiện thay đổi media query và dọn listener khi unmount.

## Kiến trúc component

### `useResponsiveViewport`

Cung cấp semantic state `isMobileTaskView`. Hook hỗ trợ API `addEventListener("change")` và fallback `addListener` cho trình duyệt cũ/test harness.

### `MobileTaskList`

Nhận `tasks` cùng callbacks mở, xóa và đổi trạng thái. Component render đúng sáu nhóm theo thứ tự:

1. `todo`
2. `in_review`
3. `needs_changes`
4. `ready`
5. `done`
6. `cancelled`

Mỗi nhóm có heading, label, số lượng, nút thu gọn/mở rộng và empty state. Trạng thái thu gọn được giữ trong `TaskBoard`, nên không mất khi task detail mở rồi đóng. Mobile view không gắn drag/drop handlers.

### `MobileTaskFilters`

Nút mở filter hiển thị badge bằng số trường filter khác rỗng. Sheet giữ một bản nháp riêng; chỉnh draft không cập nhật query. `Áp dụng` gọi callback với draft và đóng sheet. `Xóa bộ lọc` đưa draft và query về giá trị rỗng. `Hủy` đóng sheet và không thay đổi query đã áp dụng.

### `ResponsiveTaskOverlay`

Wrapper dùng cho create, detail và edit flow. Desktop giữ dialog hiện tại. Mobile trình bày sheet gần toàn màn hình với header/footer sticky và content cuộn độc lập. Wrapper quản lý backdrop, khóa cuộn document, `Escape`, initial focus và focus restoration.

## Bố cục mobile

- Page header xếp dọc; hành động tạo task có vùng chạm tối thiểu 44x44px.
- Dashboard hiển thị hai cột khi vừa, tự xuống một cột khi nội dung không vừa.
- Toolbar chứa nút tạo task và nút filter có badge.
- Danh sách nhóm xếp dọc, không tạo cuộn ngang ở cấp trang.
- Task card cho phép mở chi tiết, xóa và đổi trạng thái như hiện tại.
- Pagination xếp dọc; hai nút điều hướng chia đều chiều rộng.
- Text dài được wrap hoặc truncate có kiểm soát; không làm tràn viewport.

## Filter sheet

- Dùng `role="dialog"`, `aria-modal="true"` và accessible label.
- Backdrop khóa cuộn trang nền khi sheet mở.
- Đóng bằng nút đóng, click backdrop hoặc `Escape`.
- Click bên trong sheet không đóng overlay.
- Focus ban đầu vào heading hoặc control đầu tiên; khi đóng trả về nút filter.
- Footer sticky chứa `Xóa bộ lọc`, `Hủy` và `Áp dụng`.
- Nếu cập nhật dữ liệu thất bại sau khi apply, error hiển thị trên trang và query/filter đã chọn vẫn được giữ.

## Task overlays

- Mobile sheet dùng chiều cao gần toàn viewport và safe-area inset.
- Header có tiêu đề và nút đóng; footer chứa hành động chính/phụ.
- Chỉ content giữa cuộn.
- Không tự đóng khi form validation hoặc API lỗi.
- Create thành công đóng sheet và refresh dữ liệu như hiện tại.
- Detail/edit giữ nguyên callback và mutation nghiệp vụ.

## State và data flow

`TaskBoard` tiếp tục sở hữu query, page, selected task, create state và mutations. State trình bày bổ sung:

- `isMobileTaskView`
- tập status đang thu gọn
- filter sheet open state
- filter draft

Desktop Kanban và mobile list cùng dùng `tasksQuery.data.items`; không tạo query hoặc API request thứ hai. Filter apply tiếp tục reset page về 1. Active collapsed groups không tự đổi khi filter khiến nhóm rỗng.

## Accessibility

- Heading nhóm và toggle liên kết bằng `aria-expanded`/`aria-controls`.
- Sheet có dialog semantics, focus management và `Escape` behavior.
- Mọi control có vùng chạm tối thiểu 44x44px và focus indicator nhìn thấy.
- Badge không phải tín hiệu duy nhất; accessible label nêu số filter đang áp dụng.
- Empty, loading, error và pending state có text cue.
- Animation sheet tôn trọng `prefers-reduced-motion`.

## Kiểm thử

Automated tests phải xác nhận:

- Desktop render Kanban; mobile render `MobileTaskList`.
- Sáu nhóm đúng thứ tự, số lượng và empty state.
- Collapse state giữ nguyên sau khi mở/đóng detail.
- Mobile view không có drag/drop handlers.
- Filter badge đếm đúng trường khác rỗng.
- Draft không áp dụng khi cancel; apply reset page; clear đưa query về rỗng.
- Sheet đóng bằng backdrop/`Escape`, click bên trong không đóng và focus được phục hồi.
- Create/detail overlay có dialog semantics.
- Existing task mutations và optimistic rollback tiếp tục pass.

Viewport validation matrix:

- 320x568
- 375x812
- 768x1024
- 1024x768
- 1440x900

Quality gates:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Tiêu chí nghiệm thu

- Không có cuộn ngang cấp trang từ 320px.
- Dưới 768px, task hiển thị thành danh sách nhóm theo trạng thái.
- Filter dùng bottom sheet có draft/apply/clear/badge.
- Create/detail/edit dùng sheet gần toàn màn hình trên mobile.
- Mobile hỗ trợ cảm ứng và bàn phím; focus không bị mất sau khi đóng sheet.
- Desktop Kanban giữ nguyên dữ liệu, drag/drop và mutation behavior.
- Tất cả quality gates thành công.

