import socket,json,sys
code=open(sys.argv[1]).read()
s=socket.create_connection(('127.0.0.1',9876),timeout=20);s.settimeout(180)
s.sendall(json.dumps({'type':'execute_code','params':{'code':code}}).encode())
b=b''
while True:
 b+=s.recv(65536)
 try:
  r=json.loads(b);break
 except json.JSONDecodeError:pass
print(json.dumps(r,ensure_ascii=False,indent=2))
