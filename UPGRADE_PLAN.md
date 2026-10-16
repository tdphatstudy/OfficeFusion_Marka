# Khảo sát và kế hoạch nâng cấp Marka

Ngày khảo sát: 15/10/2026. Phạm vi: code hiện có, các luồng viết tài liệu và kiểm thử app Electron.
Đây là khảo sát kỹ thuật/UX; chưa có phỏng vấn người dùng hoặc dữ liệu analytics.

## Những vấn đề ảnh hưởng trực tiếp tới người dùng

| Phát hiện                                          | Ảnh hưởng                                                         | Ưu tiên |
| -------------------------------------------------- | ----------------------------------------------------------------- | ------- |
| Source dùng textarea, Split chưa có implementation | Thiếu điều hướng, lịch sử sửa, tìm/thay thế và đối chiếu Markdown | P0      |
| New/Open/Close không bảo vệ thay đổi chưa lưu      | Mất nội dung khi chuyển tài liệu hoặc đóng cửa sổ                 | P0      |
| Rich cập nhật store qua debounce                   | Lưu hoặc đổi mode ngay sau khi gõ có thể bỏ sót nội dung          | P0      |
| Save đánh dấu sạch mà không kiểm tra snapshot      | Phần gõ thêm trong lúc lưu bị đánh dấu đã lưu sai                 | P0      |
| Outline dựa vào index của DOM line                 | Nhảy sai vị trí trong Source, nhận nhầm heading trong code fence  | P1      |
| Cài đặt thiếu UI, shortcut xung đột Save As/Source | Tính năng khó khám phá, thao tác không thống nhất                 | P1      |
| Lỗi I/O không được phản hồi rõ                     | Người dùng không biết tài liệu đã lưu/xuất thành công chưa        | P1      |
| README ghi workspace, Mermaid và DOCX chưa có      | Kỳ vọng sản phẩm khác với app thực tế                             | P1      |

## Đợt đã triển khai

| Nhóm              | Thay đổi                                                                                 | Tiêu chí chấp nhận                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| An toàn tài liệu  | Guard Save/Discard/Cancel cho New/Open/Close; Save As; snapshot lưu theo document ID     | Hủy giữ nguyên nội dung; save lỗi giữ dirty; gõ trong lúc lưu vẫn dirty; save cũ không tác động tài liệu mới    |
| Recovery          | Bản nháp local được validate, debounce 600 ms, flush khi unload, banner phục hồi         | Phục hồi cả edit rỗng; dữ liệu hỏng không làm app crash; Discard khi đóng không tạo lại draft                   |
| Source            | CodeMirror 6, Markdown highlight, history, tìm/thay thế, line numbers, wrap, tab size    | Đổi preferences giữ nội dung; 10.000 dòng được virtualize; outline đưa caret đến dòng heading                   |
| Preview           | Worker riêng, debounce 120 ms, bỏ kết quả stale, sanitize HTML, GFM/math/footnotes       | Script/event handler/URL nguy hiểm bị loại; preview mới nhất thắng; typing không chờ parser chạy trên UI thread |
| Layout            | Split resize bằng chuột/phím, stack ở cửa sổ nhỏ, outline và stats đồng nhất             | Hoạt động ở 1280×800 và 800×600; không tràn shell                                                               |
| Khám phá thao tác | File menu, Commands với keyboard navigation, templates, Settings, Focus                  | Có trạng thái không tìm thấy lệnh; icon có accessible name; Save As không xung đột Source                       |
| Xuất tài liệu     | PDF/HTML/TXT từ mọi mode, sanitize chung với preview, MathML cho export                  | Ghi được file thật; PDF đúng header; HTML không chứa script; giải phóng print window khi lỗi                    |
| Hiệu năng         | Lazy-load editor/preview, tách vendor chunks, selector Zustand, dedupe preference writes | Chỉ ghi preference khi đổi; parser preview không chặn gõ; engine không tải vào shell qua barrel import          |

State tài liệu thuộc editor store; state UI tạm thuộc UI store và không persist. File actions dùng
chung cho menu, shortcut và command palette. Editor instances sở hữu selection/history. Preview
worker chỉ nhận snapshot và trả HTML; không có quyền IPC hoặc file system.

Rich editor chỉ dành cho cú pháp mà nó có thể giữ được. Tài liệu có frontmatter, math, footnotes,
Mermaid hoặc trên 100.000 ký tự được giữ ở Source/Split. Không chuyển qua Rich rồi serialize mất dữ
liệu.

## Roadmap đề xuất sau đợt này

Đợt 2 đã bổ sung logo SVG mới và icon desktop đồng bộ, nút Light/Dark trực tiếp, Connection Hub cho
Local/WSL/SSH/Network/URL, recent documents và profile kết nối. SSH hỗ trợ đọc/ghi với host trust,
password/key được chọn tường minh, passphrase, custom port, fingerprint pinning và optimistic
conflict checks. Hướng dẫn và giới hạn ở [CONNECTIONS.md](./CONNECTIONS.md).

1. **Workspace và nhiều tài liệu:** mở folder, file tree, tabs, quick open, drag/drop. Cần model
   document riêng cho từng tab, guard close từng tab và recovery theo workspace.
2. **Lưu trữ vững hơn:** atomic writes, phát hiện file đổi bên ngoài, diff/conflict resolution,
   autosave tùy chọn và lịch sử phiên bản. Không tự ghi đè thay đổi từ ứng dụng khác.
3. **Rich editing hoàn chỉnh:** link/image dialogs có validation, quản lý asset local, thao tác
   hàng/cột bảng, fidelity tests cho callout/HTML và frontmatter inspector.
4. **Định dạng và xuất bản:** Mermaid sandboxed rendering, DOCX/EPUB với kiểm thử round-trip, cấu
   hình trang PDF và template xuất bản.
5. **OfficeFusion:** shared design tokens, mở tài liệu từ app khác, search toàn workspace và i18n
   Việt/Anh. Cloud sync/collaboration cần contract tài khoản, quyền truy cập và conflict handling.

Ưu tiên khảo sát người dùng ở bước tiếp: họ chủ yếu ghi chú, viết tài liệu kỹ thuật hay soạn báo
cáo; bao nhiêu file thường mở cùng lúc; format trao đổi với các app OfficeFusion nào; lỗi hoặc thao
tác nào tốn thời gian nhất. Kết quả này sẽ quyết định thứ tự P1 thay vì thêm tính năng theo số
lượng.

## Cách xác nhận chất lượng

Regression tests bảo vệ state và I/O orchestration. Smoke tests mở app Electron đã build, dùng
profile riêng, thao tác UI và ghi file thật. Mỗi lỗi phát hiện được sửa rồi chạy lại nhóm liên quan;
sau đó chạy lint, cả hai TypeScript project, regression suite, production build và toàn bộ smoke
suite. Kết quả và giới hạn kiểm chứng được ghi trong [QA_REPORT.md](./QA_REPORT.md).
