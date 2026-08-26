import requests
url = 'https://drive.usercontent.google.com/download?id=1kyOJRyPPMaaIw12e19uhFkqBAQrDIKWN&export=download&confirm=t'
r = requests.get(url, timeout=60, headers={'User-Agent': 'Mozilla/5.0'})
with open(r'C:\Users\bansa\Downloads\job_ticket-tracking-system (1)\test_catalogue.jpg', 'wb') as f:
    f.write(r.content)
print(f'Downloaded: {len(r.content)} bytes, Content-Type: {r.headers.get("Content-Type", "unknown")}')
