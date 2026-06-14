import qrcode
import cv2
from PIL import Image
import numpy as np

# --- 1. yüksek kaliteli vCard QR kodu üret ---
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

qr = qrcode.QRCode(
    version=None,
    error_correction=qrcode.constants.ERROR_CORRECT_H,  # en yüksek hata düzeltme
    box_size=12,
    border=2,
)
qr.add_data(vcard)
qr.make(fit=True)

qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
qr_img.save("Kartvizit_QR_Kod_HD.png")
print(f"QR boyutu: {qr_img.size}")

# --- 2. Eski QR'ı kartvizit üzerinde tespit et ve yenisiyle değiştir ---
kartvizit = Image.open("kartvizit.jpg.jpeg").convert("RGB")
kartvizit_cv = cv2.cvtColor(np.array(kartvizit), cv2.COLOR_RGB2BGR)

detector = cv2.QRCodeDetector()
found, _, points, _ = detector.detectAndDecodeMulti(kartvizit_cv)

if found and points is not None:
    pts = points[0]
    x_min = int(min(p[0] for p in pts))
    y_min = int(min(p[1] for p in pts))
    x_max = int(max(p[0] for p in pts))
    y_max = int(max(p[1] for p in pts))
    
    # biraz boşluk bırak (padding)
    pad = 6
    x_min = max(0, x_min - pad)
    y_min = max(0, y_min - pad)
    x_max = min(kartvizit.width, x_max + pad)
    y_max = min(kartvizit.height, y_max + pad)
    
    w = x_max - x_min
    h = y_max - y_min
    
    print(f"Eski QR bulundu: x={x_min}-{x_max}, y={y_min}-{y_max}, boyut={w}x{h}")
    
    # Yeni QR'ı tam aynı bölge boyutuna getir
    yeni_qr = qr_img.resize((w, h), Image.Resampling.LANCZOS)
    kartvizit.paste(yeni_qr, (x_min, y_min))
    kartvizit.save("kartvizit_hazir_v2.jpg", quality=98)
    print("Kaydedildi: kartvizit_hazir_v2.jpg")
else:
    print("HATA: Eski QR tespit edilemedi, koordinatları manuel gir!")
    # Kartvizit boyutunu göster
    print(f"Kartvizit boyutu: {kartvizit.size}")
