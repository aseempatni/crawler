import sys
import json
import cv2
import numpy as np
from matplotlib import pyplot as plt
from pprint import pprint

def containsLink (x,y,link):
	yLink = int(link['top'])
	xLink = int(link['left'])
	height = int(link['height'])
	width = int(link['width'])
	if containsPoint(x,y,xLink,yLink):
		return True
	if containsPoint(x,y,xLink+width,yLink):
		return True
	if containsPoint(x,y,xLink,yLink+height):
		return True
	if containsPoint(x,y,xLink+width,yLink+height):
		return True
	return False

def containsPoint (x,y,xp,yp):
	if xp>x and xp<x+boxSize:
		if yp>y and yp<y+boxSize:
			return True
	return False


font = cv2.FONT_HERSHEY_SIMPLEX
boxSize = 300
moveSize = 300
cordinates = sys.argv[1];
image = sys.argv[2];
img = cv2.imread(image)
heightPage, widthPage  = img.shape[:2]
pprint(heightPage)

left = widthPage
right = 0
with open(cordinates) as data_file:    
    data = json.load(data_file)

for link in data:
	link = json.loads(link)	
	yLink = int(link['top'])
	xLink = int(link['left'])
	if xLink<left:
		left = xLink
	height = int(link['height'])
	width = int(link['width'])
	if (xLink+width) >right:
		right = xLink+width 
	cv2.rectangle(img,(xLink,yLink),(xLink+width,yLink+height),(40,50,200),2)

cv2.line(img,(left,0),(left,heightPage),(255,0,0),5)
cv2.line(img,(right,0),(right,heightPage),(255,0,0),5)
ymax = (heightPage - heightPage%10) - boxSize
print ymax
y=0
while True:	
	x=0
	if y+boxSize>heightPage:
		break
	while True:	
		if x+boxSize>widthPage:
			break
		cv2.rectangle(img,(x,y),(x+boxSize,y+boxSize),(80,100,20),2)
		counter=0
		for link in data:
			link = json.loads(link)	
			if containsLink(x,y,link):
				counter+=1
		print counter
		cv2.putText(img,str(counter),(x+boxSize/2,y+boxSize), font, 4,(0,0,0),2, cv2.FONT_HERSHEY_PLAIN)
		x += moveSize
	y += moveSize


saveImage = image+'-analyzed.jpg'
cv2.imwrite(saveImage,img)
cv2.imshow('image',img)
cv2.waitKey(0)
cv2.destroyAllWindows()