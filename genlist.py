from textwrap import indent
from PIL import Image
import json

img = Image.open("masterpiece.png")

stuff_cringe = json.loads('[{"hex":"#BE0039","index":1,"__typename":"Color"},{"hex":"#FF4500","index":2,"__typename":"Color"},{"hex":"#FFA800","index":3,"__typename":"Color"},{"hex":"#FFD635","index":4,"__typename":"Color"},{"hex":"#00A368","index":6,"__typename":"Color"},{"hex":"#00CC78","index":7,"__typename":"Color"},{"hex":"#7EED56","index":8,"__typename":"Color"},{"hex":"#00756F","index":9,"__typename":"Color"},{"hex":"#009EAA","index":10,"__typename":"Color"},{"hex":"#2450A4","index":12,"__typename":"Color"},{"hex":"#3690EA","index":13,"__typename":"Color"},{"hex":"#51E9F4","index":14,"__typename":"Color"},{"hex":"#493AC1","index":15,"__typename":"Color"},{"hex":"#6A5CFF","index":16,"__typename":"Color"},{"hex":"#811E9F","index":18,"__typename":"Color"},{"hex":"#B44AC0","index":19,"__typename":"Color"},{"hex":"#FF3881","index":22,"__typename":"Color"},{"hex":"#FF99AA","index":23,"__typename":"Color"},{"hex":"#6D482F","index":24,"__typename":"Color"},{"hex":"#9C6926","index":25,"__typename":"Color"},{"hex":"#000000","index":27,"__typename":"Color"},{"hex":"#898D90","index":29,"__typename":"Color"},{"hex":"#D4D7D9","index":30,"__typename":"Color"},{"hex":"#FFFFFF","index":31,"__typename":"Color"}]')

colors = []

for i in stuff_cringe:
    red = int(i["hex"][1:3], 16)
    green = int(i["hex"][3:5], 16)
    blue = int(i["hex"][5:7], 16)
    colors.append((red, green, blue, i["index"]))

def nearest_color(query):
    return min(colors, key = lambda subject: sum((s - q) ** 2 for s, q in zip(subject, query)))

pixels = []

origin_x = 1999-80-4
origin_y = 0+4

for x in range(img.size[0]):
    for y in range(img.size[1]):
        pixel = img.getpixel((x, y))
        if pixel[3] == 0:
            # transparent, ignore
            continue
        
        pixels.append((
            origin_x + x,
            origin_y + y,
            nearest_color(pixel)[3],
        ))

with open("image.json", "w") as fh:
    fh.write(json.dumps(pixels))

print("Pixel count:", len(pixels))
