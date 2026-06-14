import qrcode
import cv2
from PIL import Image, ImageDraw
import numpy as np

# vCard verisi
vcard = (
    "BEGIN:VCARD\n"
    "VERSION:3.0\n"
    "N:TARHAN;YILDIRIM;;;\n"
    "FN:YILDIRIM TARHAN\n"
    "ORG:KURUMSAL TEDARİKÇİ\n"
    "TITLE:Computer Engineer / Software Developer\n"
    "TEL;TYPE=CELL:+905059112749\n"
    "TEL;TYPE=WORK:+902662255254\n"
    "EMAIL:yildirimtarhan@tedarikci.org.tr\n"
    "URL:https://www.tedarikci.org.tr\n"
    "ADR:;;Hacı Yusuf Mah. Ortaokul Cad. Eser Sokak No:4/10;Bandırma;Balıkesir;;Turkey\n"
    "END:VCARD"
)

# Yüksek kalite QR üret
qr = qrcode.QRCode(
    version=None,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=14,
    border=2,
)
qr.add_data(vcard)
qr.make(fit=True)
qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")

# Kartviziti aç
kartvizit = Image.open("kartvizit.jpg.jpeg").convert("RGB")
kw, kh = kartvizit.size
print(f"Kartvizit boyutu: {kw}x{kh}")

# OpenCV ile eski QR'ı bul
kartvizit_cv = cv2.cvtColor(np.array(kartvizit), cv2.COLOR_RGB2BGR)
detector = cv2.QRCodeDetector()
found, _, points, _ = detector.detectAndDecodeMulti(kartvizit_cv)

if found and points is not None:
    pts = points[0]
    x_min = int(min(p[0] for p in pts))
    y_min = int(min(p[1] for p in pts))
    x_max = int(max(p[0] for p in pts))
    y_max = int(max(p[1] for p in pts))
    
    # QR alanını %40 büyüt
    cx = (x_min + x_max) // 2
    cy = (y_min + y_max) // 2
    w = x_max - x_min
    h = y_max - y_min
    
    new_size = int(max(w, h) * 1.5)  # %50 daha büyük
    nx1 = max(0, cx - new_size // 2)
    ny1 = max(0, cy - new_size // 2)
    nx2 = min(kw, cx + new_size // 2)
    ny2 = min(kh, cy + new_size // 2)
    
    nw = nx2 - nx1
    nh = ny2 - ny1
    ns = min(nw, nh)  # kare yap
    
    print(f"Eski QR: x={x_min}-{x_max}, y={y_min}-{y_max}")
    print(f"Yeni QR alanı: x={nx1}-{nx2}, y={ny1}-{ny2}, boyut={ns}x{ns}")
    
    # Önce arka planı düzelt: o bölgeyi koyu navy ile doldur
    draw = ImageDraw.Draw(kartvizit)
    draw.rectangle([nx1-5, ny1-5, nx2+5, ny2+5], fill=(10, 23, 58))
    
    # Beyaz çerçeveli QR
    qr_resized = qr_img.resize((ns, ns), Image.Resampling.LANCZOS)
    
    # QR etrafına beyaz çerçeve ekle
    bordered_size = ns + 16
    bordered = Image.new("RGB", (bordered_size, bordered_size), (255, 255, 255))
    bordered.paste(qr_resized, (8, 8))
    
    # Ortalayarak yapıştır
    paste_x = cx - bordered_size // 2
    paste_y = cy - bordered_size // 2
    paste_x = max(0, min(kw - bordered_size, paste_x))
    paste_y = max(0, min(kh - bordered_size, paste_y))
    
    kartvizit.paste(bordered, (paste_x, paste_y))
    kartvizit.save("kartvizit_son.jpg", quality=98)
    print(f"Kaydedildi: kartvizit_son.jpg")
else:
    print("HATA: QR tespit edilemedi!")
    print(f"Kartvizit boyutu: {kartvizit.size}")
