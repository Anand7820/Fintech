import cv2
import pytesseract
from app.services.preprocessing import preprocess_document

img_path = '/Users/anandkamble/Downloads/AnandPAN.jpeg'
img = cv2.imread(img_path)
processed_bgr, _ = preprocess_document(img)

h, w = processed_bgr.shape[:2]
crop = processed_bgr[int(h * 0.08) : int(h * 0.92), int(w * 0.22) : int(w * 0.65)]
gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
enhanced = clahe.apply(gray)

for p in [3, 4, 6, 11]:
    text = pytesseract.image_to_string(enhanced, config=f'--psm {p}')
    print(f'=== PSM {p} ===\n', text.strip()[:200])
