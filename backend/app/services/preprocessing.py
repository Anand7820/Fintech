import cv2
import numpy as np

from app.models.schemas import PreprocessingSummary


def preprocess_document(image_bgr: np.ndarray) -> tuple[np.ndarray, PreprocessingSummary]:
    """
    Apply grayscale conversion, noise reduction, and deskew correction.
    Returns processed BGR image (for downstream OCR) and summary metrics.
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, None, h=10, templateWindowSize=7, searchWindowSize=21)

    angle, deskewed = _deskew(denoised)
    # Re-expand to 3-channel for OCR / forgery modules expecting BGR
    processed_bgr = cv2.cvtColor(deskewed, cv2.COLOR_GRAY2BGR)

    height, width = processed_bgr.shape[:2]
    summary = PreprocessingSummary(
        grayscale_applied=True,
        noise_reduction_applied=True,
        deskew_angle_degrees=round(angle, 2),
        output_width=width,
        output_height=height,
    )
    return processed_bgr, summary


def _deskew(gray: np.ndarray) -> tuple[float, np.ndarray]:
    """Estimate skew via min-area rectangle on foreground pixels and rotate."""
    binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    coords = cv2.findNonZero(binary)
    if coords is None:
        return 0.0, gray

    rect = cv2.minAreaRect(coords)
    angle = rect[-1]
    if angle < -45:
        angle = 90 + angle
    elif angle > 45:
        angle = angle - 90

    if abs(angle) < 0.5:
        return 0.0, gray

    h, w = gray.shape[:2]
    center = (w // 2, h // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        gray,
        matrix,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return float(angle), rotated
