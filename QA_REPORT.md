# Marka — Kết quả kiểm chứng đợt nâng cấp UX

Ngày: 15/10/2026. Môi trường: Windows, Node 20.19.5, pnpm 9, Electron 33.4.11.

## Các lớp kiểm tra

| Kiểm tra                                                       | Kết quả                                         |
| -------------------------------------------------------------- | ----------------------------------------------- |
| ESLint, bao gồm strict TypeScript rules và zero-comment policy | Pass                                            |
| TypeScript main/preload và renderer                            | Pass                                            |
| Regression suite (`pnpm test`)                                 | 25/25 pass                                      |
| Production build (`pnpm build`)                                | Pass; không có cảnh báo chunk lớn trên renderer |
| Electron smoke suite (`pnpm test:smoke`)                       | 20/20 pass; không có renderer errors            |
| Prettier và Git whitespace check                               | Pass                                            |

Regression tests bao phủ dirty state, undo về nội dung đã lưu, save snapshot, save cũ/tài liệu mới,
gõ trong lúc lưu, Save As bị hủy, Cancel/Discard/Save khi thay tài liệu, lỗi I/O, operations chạy
chồng nhau, recovery rỗng/hỏng, outline, word count, GFM/math/footnotes, sanitize HTML/CSS, fidelity
của callout/underline/highlight/alignment và export MathML.

Smoke tests thao tác trên Electron build thật, profile riêng và file thật. Chỉ phản hồi native
dialogs được tự động hóa. Các luồng đã chạy:

- Rich edit → lưu ngay qua IPC → đọc lại file.
- Source/Split, KaTeX, outline đúng dòng, resize bằng bàn phím, tìm/thay thế.
- Preview worker nhận edit mới nhất, không hiện kết quả stale.
- Command palette bằng bàn phím, empty result, đổi theme và tạo template.
- Preferences không làm mất nội dung; recovery và preferences giữ được sau renderer reload.
- Cancel giữ edit; Open đọc file thật; Focus ẩn/khôi phục outline.
- Tài liệu 10.000 dòng; cửa sổ tối thiểu 800×600; Split stack dọc ở cửa sổ nhỏ.
- Export HTML/PDF/TXT thật; HTML sanitize; công thức MathML; PDF có header hợp lệ.
- Đóng cửa sổ native với Cancel và Discard.
- Ảnh sáng/tối tại 1280×800; kiểm tra bố cục trực tiếp qua screenshots.

## Hiệu năng đã đo

- Mở Source 10.000 dòng khoảng 86–88 ms trong các lượt smoke test trên máy hiện tại; DOM editor giữ
  dưới 500 line elements nhờ virtualization. Test đặt ngưỡng regression 5 giây để tránh phụ thuộc
  tốc độ máy CI.
- Parser preview xử lý fixture khoảng 50 KB trong khoảng 325–433 ms ở regression tests. Test đặt
  ngưỡng 2,5 giây. Trong app, parser chạy trong worker; debounce 120 ms và request ID ngăn kết quả
  cũ ghi đè edit mới.
- Renderer vendor chunks được tách theo engine; chunk lớn nhất dưới 400 KB minified trong build đã
  kiểm tra. Worker khoảng 830 KB, chỉ tải khi mở Split. Đây là số đo build, chưa phải benchmark
  startup hoặc memory toàn ứng dụng.
- Preference storage bỏ qua write có giá trị không đổi; draft write debounce 600 ms.

## Các lỗi phát hiện và sửa trong vòng review/test

- Lưu thiếu edit cuối ở Rich do debounce.
- Đánh dấu “saved” sai khi nội dung đổi trong lúc I/O.
- Bản nháp bị phục hồi lại sau Discard khi đóng app.
- Vòng lặp transaction/render vì BubbleMenu nhận object options mới mỗi render.
- Worker chọn dependency browser có yêu cầu DOM: dùng điều kiện export `worker` và khớp stylesheet
  KaTeX với phiên bản mà renderer math thực sự sử dụng.
- Nút mode mất accessible name khi ẩn nhãn ở cửa sổ nhỏ.
- Sanitizer làm mất callout, underline, highlight và alignment: cho phép đúng markup cần thiết, chỉ
  whitelist CSS text-align và tiếp tục chặn CSS tùy ý.
- Hidden print window không được giải phóng nếu export lỗi.
- Close guard giữ cửa sổ khi renderer không hoạt động: handshake readiness và cleanup listener cho
  từng cửa sổ.

## Giới hạn kiểm chứng và phần còn lại

- Chưa chạy native UI trên macOS/Linux hoặc đóng gói installer; kết quả native smoke là Windows.
- Chưa có user research, screen reader audit đầy đủ, benchmark memory/startup hoặc collaboration.
- Recovery lưu trên thiết bị, không phải autosave vào file hay cloud backup. Crash trước lần flush
  có thể mất phần edit mới nhất; quota/storage lỗi có thông báo yêu cầu Save.
- Chưa có atomic writes hoặc phát hiện file đổi bên ngoài. Xử lý xung đột filesystem là ưu tiên kế
  tiếp trong [UPGRADE_PLAN.md](./UPGRADE_PLAN.md).
- Mermaid được giữ dạng code; DOCX/EPUB, workspace tree, tabs và cloud sync chưa triển khai.
- HTML/PDF export math dùng MathML; chưa kiểm tra các trình đọc HTML cũ hoặc fidelity của mọi cú
  pháp HTML tùy biến. Plain-text export vẫn là chuyển đổi đơn giản.

Không còn lỗi chặn phát hành được phát hiện trong phạm vi thay đổi và các luồng đã kiểm chứng.
