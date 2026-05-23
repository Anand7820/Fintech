import requests

url = "http://localhost:8000/api/v1/verify"
files = {'file': open('/Users/anandkamble/Downloads/Anand fees.pdf', 'rb')}
data = {'document_type': 'auto'}

try:
    response = requests.post(url, files=files, data=data)
    print("STATUS:", response.status_code)
    print("RESPONSE:", response.text)
except Exception as e:
    print("ERROR:", e)
