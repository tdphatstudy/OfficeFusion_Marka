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

## Đợt 2 — Logo, Light mode và Connection Hub (16/10/2026)

Phạm vi: logo SVG và bộ icon desktop, nút đổi theme nhanh, đồng bộ System theme, kết nối
Local/WSL/SSH/Network/URL, profiles/recent documents, remote Save, recovery và reconnect giữ edit.

- Regression suite: **47/47 pass**, gồm validation endpoint/port/path, shell quoting, giới hạn
  UTF-8, URL redirect/cancel, remote snapshot, Save As và reconnect giữ dirty state.
- Connection smoke: **19/19 pass** trên Electron với HTTP/SSH localhost và WSL Ubuntu. Test tự sinh
  host key, client key thường/key mã hóa, mật khẩu và passphrase giả. Không đọc key/agent cá nhân
  hoặc SSH tới host thật. File remote, upload và conflict được mock phía server.
- Xác nhận sai fingerprint chặn trước authentication; sai password/passphrase báo lỗi; custom port,
  key được chọn tường minh, cancel, output quá lớn và disconnect đều được bao phủ.
- Xác nhận profile không chứa mật khẩu, passphrase hoặc key path; reload xóa credential trong main,
  recovery giữ bản nháp, reconnect xác thực lại và Save tiếp được.
- Lint, TypeScript main/preload và renderer: pass. Production build: pass, không có cảnh báo chunk
  lớn trên renderer. SSH chạy trong main bằng dependency `ssh2`, không tăng bundle renderer.
- Đã xem ảnh Connection Hub ở Light/Dark; sửa nhãn accessibility của select, thông báo lỗi bị lặp,
  lỗi encoding placeholder và nút đổi theme bị lệch khi System appearance đổi.
- Editor smoke trên build cuối: **20/20 pass**, không có renderer errors. Source 10.000 dòng mở
  khoảng **145 ms** trong lượt này. WSL test chỉ mở/ghi file do test tạo trong `/tmp`, rồi xóa file.

Review cuối không phát hiện lỗi chặn phát hành trong phạm vi thay đổi. SSH credentials không nằm
trong profiles/recovery, main process xóa phiên khi reload/crash/close hoặc hết hạn. Fixture keys và
test profiles được Git ignore và loại khỏi danh sách đóng gói. Có thể rollback bằng revert commit;
profile mới là dữ liệu cục bộ, không có migration server hay thay đổi hệ thống SSH của người dùng.

Test cuối giữ main process chạy sau khi đóng cửa sổ và xác nhận credential cache được clear ngay, kể
cả khi timer hết hạn vẫn còn tồn tại. Lỗi giữ tham chiếu qua timer đã được sửa và kiểm tra lại.

Giới hạn: SSH hiện kết nối trực tiếp, chưa hỗ trợ SSH config/ProxyJump, keyboard-interactive/MFA
hoặc hardware keys. Remote Save cần Linux GNU coreutils và file thường có sẵn, không ghi symlink.
Hai lần kiểm tra hash và staged rename giảm rủi ro ghi đè, nhưng không phải transaction lock;
disconnect sau commit có thể khiến kết quả lưu không chắc chắn. Local/WSL/network vẫn dùng luồng ghi
local hiện tại, chưa có conflict detection/atomic replacement. Chưa kiểm thử installer và native UI
macOS/Linux; không có benchmark startup/memory toàn app. Chi tiết ở
[CONNECTIONS.md](./CONNECTIONS.md).

## Đợt 3 — Hướng thiết kế ngòi bút và document shell (16/10/2026)

Người dùng chọn concept 01 — ngòi bút — sau khảo sát tài liệu chính thức và review các hướng thiết
kế. Logo Light/Dark giữ cùng hình học; icon desktop thêm keyline cho nền thay đổi. Đã kiểm tra
counter/slit trong suốt, chín kích thước PNG, container ICNS và xem bản native 16/24/32/48 px.

Titlebar giữ app/tài liệu/window controls. File/Edit/View nhóm lệnh thật; document toolbar giữ
Write/Markdown/Split và định dạng theo editor đang mount. Canvas viết liên tục, outline gọn, đường
dẫn chỉ ở status bar. Outline ở cửa sổ nhỏ dùng state riêng, không ghi đè preference desktop. Các
quy ước dùng chung OfficeFusion hiện là đề xuất; chưa có app/brand book khác để đối chiếu.

Review độc lập đã kiểm tra routing lệnh, guard Markdown, dirty/recovery, ownership của editor và
cleanup history listener. Đã sửa các finding và lỗi kiểm thử phát hiện:

- Toggle định dạng trong menu có checkbox semantics và dấu check trang trí, không chèn dấu vào
  accessible name của lệnh.
- Lệnh editor từ Edit chạy sau khi menu đóng: Undo/Redo trả focus đúng ở cả hai engine, Find không
  bị focus trap lấy lại ô tìm kiếm. Native test kiểm tra gõ tiếp ngay sau history action.
- Outline bỏ thẻ inline HTML ở tiêu đề có underline/highlight và không nhận heading trong HTML pre.

Regression **48/48 pass**, gồm test mới cho heading có rich formatting. Connection smoke **19/19
pass** với password/key/passphrase tự sinh trên localhost và file fixture WSL `/tmp`. Reviewer đã
xem ảnh Connection Hub Light/Dark và không phát hiện lỗi bố cục chặn luồng trong các ảnh đó.

Editor/export smoke trên build cuối: **26/26 pass**, không có renderer errors. Ngoài các luồng cũ,
test kiểm tra selection qua Bold/Heading/Underline, accessible checked state khi mở lại menu, Edit
Undo/Redo và gõ tiếp ở cả hai engine, Edit Find nhận input, View menu giữ guard, compact outline giữ
preference desktop và Write ở 800×600 vẫn truy cập được các định dạng qua overflow. Source 10.000
dòng mở khoảng **132 ms** ở lượt này, DOM vẫn được virtualize.

Lint, TypeScript main/preload và renderer, production build, formatting và Git whitespace check
pass. Đã xem ảnh thật của Write/Split Light/Dark, Settings Dark, Connection Hub và cửa sổ nhỏ; không
còn lỗi chặn luồng được phát hiện trong phạm vi đã kiểm tra.

Đã tính 30 cặp token chữ/nền Light/Dark, gồm surface thường/raised/overlay/canvas, selected action
và filled action/hover. Thấp nhất **4,51:1**. Đây là kiểm tra token, không phải chứng nhận
accessibility toàn ứng dụng.

Quy ước thiết kế, nguồn khảo sát và cách tạo lại asset ở [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).
Không thêm dependency hoặc thay đổi SSH authentication trong đợt này. Các giới hạn native
macOS/Linux, installer, user study, screen reader audit và startup/memory benchmark ở trên vẫn áp
dụng.

## Đợt 4 — Performance, security và file safety (17/10/2026)

Môi trường: Windows, Node 20.19.5, pnpm 9, Electron 44.9.0, electron-builder 26.15.3. Bảng này là
kết quả hiện tại; các số liệu và giới hạn ở các đợt trước là lịch sử.

| Kiểm tra                                                           | Kết quả                       |
| ------------------------------------------------------------------ | ----------------------------- |
| ESLint, TypeScript main/preload + renderer                         | Pass                          |
| Regression (`pnpm test`)                                           | 83/83 pass                    |
| Native editor (`pnpm test:smoke`)                                  | 27/27 pass                    |
| Connections (`MARKA_TEST_WSL_DISTRO=Ubuntu pnpm test:connections`) | 19/19 pass                    |
| Native security (`pnpm test:security`)                             | 14/14 pass                    |
| Windows unpacked package                                           | Pass, không publish, không ký |
| ASAR runtime (`pnpm test:package`)                                 | 2/2 pass                      |
| Production dependency audit                                        | 0 advisory                    |

Test mới bao phủ: file vượt 5 MiB qua viewer 64 KiB, offset 10 GiB bằng mock đọc có allocation giới
hạn, UTF-8 bị chia giữa page/short read, file đổi khi xem, xung đột giữa hai FileAccess, write
serialize, replace lỗi giữ bản gốc/cleanup stage, thao tác hết quyền trước commit, external write
ngay sau commit không trở thành baseline, Save As grants có giới hạn, BOM/CRLF, hardlinks và file
chưa cấp quyền. Native test thêm sender không tin cậy, payload/handle sai, sandbox thật, PDF
script-disabled, recovery sau reload, key phải qua picker, migration từ file-origin và bảo toàn ảnh
nhúng qua edit/Save.

Recovery có test session isolation, newest-first với 40 metadata records, cap 32 không âm thầm xóa,
quota failure giữ checkpoint cũ và max-wait khi edit liên tục. Editor có byte-admission cho paste
UTF-8, kể cả boundary surrogate/emoji, và Write có giới hạn riêng; final tree budget được test sau
KaTeX mở rộng. Preview queue giữ một active/một latest pending, timeout/abort và loại response stale
được kiểm tra.

Review độc lập phát hiện và vòng test đã sửa: revision export lấy quá muộn, reopen alias bị stale,
debounce recovery không flush khi gõ liên tục, index chỉ lấy UUID đầu, paste vượt budget không lưu
được, plugin unified bị deduplicate khiến final tree guard không chạy, image bị Rich parser bỏ,
short range read không tiến, ACL bị broaden khi copy/rename, và closed-window cleanup truy cập
webContents đã destroy. WSL fixture lặp tìm được birthtime thay đổi giả; identity hiện dùng standard
device/inode cùng hash và change metadata. Test giữ original/draft khi từ chối thao tác.

Windows ACL fixture dùng owner-only protected DACL, xác nhận Owner/Group/DACL khớp sau stage/Save.
Stage rỗng được tạo với ACL trước khi ghi dữ liệu, không dựa vào copyFile để bảo toàn DACL. Bộ test
chỉ dùng mật khẩu/keys sinh trong fixture, HTTP/SSH localhost và file WSL `/tmp` sinh riêng; không
dùng key/agent cá nhân hay host thật.

Benchmark warm trong process (`node scripts/benchmark-editor.mjs`,30samples/case): malformed
word-count 16 KB median 0.143 ms / p95 0.295 ms;64 KB median 0.544 ms;256 KB median 2.304 ms.
Transaction admission/update trên document 4,370,000 characters median 0.121 ms / p95 0.729 ms; số
này không bao gồm layout, serialization checkpoint hay toàn bộ input-to-paint. Source 10.000 dòng mở
84 ms ở lượt native cuối, DOM <500 line elements. Các số đo là local, không phải cam kết
latency/RSS.

Windows package dùng allowlist runtime/assets, loại project source/private research/fixture khỏi
ASAR. Packaged-ASAR module được launch trong Electron 44 với profile riêng, kiểm preload, preview
worker và PDF export worker thật. Chưa kiểm installer, signing/notarization hoặc OS integration của
Marka.exe. Loại optional cpu-features để dùng fallback JavaScript của ssh2 đã được native mock test;
đóng gói không cần cài C++ toolchain cho addon này.

Full development audit còn 4 findings (1 high / 3 moderate: braces, sprintf-js,
postcss-selector-parser), trong khi production-only audit sạch. Chưa có bản upstream fix cho một số
finding; không ép transitive major versions chỉ để làm báo cáo audit về 0. Danh sách/giới hạn vận
hành ở [RELIABILITY.md](./RELIABILITY.md).

Các giới hạn còn lại: file 10 GiB thật/RSS chưa benchmark, viewer read-only, chưa CRDT/merge UI,
external-writer finalcheck/rename race chưa strict CAS, chưa chứng nhận power-loss durability,
SACL/ADS/EFS hoặc metadata trên mọi filesystem. macOS existing-file replacement fail closed và
native macOS/Linux UI chưa được chứng nhận. Origin migration 44 được test, chưa certify nâng định
dạng database Chromium 33→44. Các giới hạn này không được coi là testcase đã pass.
