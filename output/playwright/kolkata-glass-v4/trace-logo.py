import json, math
from pathlib import Path
from PIL import Image
base=Path(__file__).resolve().parent
im=Image.open(base.parents[2]/'public/logo/superpro-mark-white.png').convert('RGBA')
im.thumbnail((280,190))
w,h=im.size
p=im.getchannel('A')
inside=lambda x,y: 0<=x<w and 0<=y<h and p.getpixel((x,y))>128
edges={}
for y in range(h):
 for x in range(w):
  if not inside(x,y):continue
  for test,a,b in [(not inside(x,y-1),(x,y),(x+1,y)),(not inside(x+1,y),(x+1,y),(x+1,y+1)),(not inside(x,y+1),(x+1,y+1),(x,y+1)),(not inside(x-1,y),(x,y+1),(x,y))]:
   if test:edges.setdefault(a,[]).append(b)
def rdp(points,e):
 if len(points)<3:return points
 a,b=points[0],points[-1];dx,dy=b[0]-a[0],b[1]-a[1];den=math.hypot(dx,dy)
 ds=[abs(dy*(v[0]-a[0])-dx*(v[1]-a[1]))/den if den else math.hypot(v[0]-a[0],v[1]-a[1]) for v in points]
 k=max(range(len(ds)),key=ds.__getitem__)
 return rdp(points[:k+1],e)[:-1]+rdp(points[k:],e) if ds[k]>e else [a,b]
loops=[]
while edges:
 start=next(iter(edges));v=start;poly=[]
 while True:
  poly.append(v);n=edges[v].pop()
  if not edges[v]:del edges[v]
  v=n
  if v==start:break
  if v not in edges:break
 if len(poly)>20:
  mid=len(poly)//2
  simple=rdp(poly[:mid+1],1.35)[:-1]+rdp(poly[mid:]+[poly[0]],1.35)[:-1]
  loops.append([[(x-w/2)/w,(h/2-y)/w] for x,y in simple])
(base/'logo-paths.json').write_text(json.dumps(loops))
print('Traced',len(loops),'outlines',sum(map(len,loops)),'vertices')
