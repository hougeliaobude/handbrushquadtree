let quadtree;
let myShader;
let gridWidth = 5;
let gridHeight = 10;
let isDragging = false;
let mouseTrail = [];
const MAX_DEPTH = 13;
let influenceRadius = 100;
let lastMousePos;
let lastMouseVelocity;
let maxRadius = 200;
let minRadius = 40;
let absoluteMaxRadius = 900;
let interpolationSlider;
let interpolationFactor = 1;
let resetButton;
let radiusScaleSlider;
let radiusScaleFactor = 1;
let exportSVGButton;
let myFont;
let strokeWeightSlider; // 新增：描边粗细滑块
let strokeWeightValue = 1; // 新增：描边粗细值，默认为1

function preload() {
  myShader = loadShader('vertex.glsl', 'fragment.glsl');
  myFont = loadFont('https://cdnjs.cloudflare.com/ajax/libs/topcoat/0.8.0/font/SourceCodePro-Bold.otf');
}

function setup() {
  createCanvas(800, 800, WEBGL);
  textFont(myFont);
  createQuadTree();
  
  interpolationSlider = createSlider(0, 3, interpolationFactor);
  interpolationSlider.position(10, height + 10);
  interpolationSlider.style('width', '200px');

  resetButton = createButton('重置');
  resetButton.position(220, height + 10);
  resetButton.mousePressed(resetSketch);

  radiusScaleSlider = createSlider(0.2, 4, radiusScaleFactor, 0.1);
  radiusScaleSlider.position(10, height + 40);
  radiusScaleSlider.style('width', '200px');

  // 新增：创建描边粗细滑块
  strokeWeightSlider = createSlider(0.1, 5, strokeWeightValue, 0.1);
  strokeWeightSlider.position(10, height + 70);
  strokeWeightSlider.style('width', '200px');

  exportSVGButton = createButton('导出 SVG');
  exportSVGButton.position(320, height + 10);
  exportSVGButton.mousePressed(exportSVG);
}

function draw() {
  interpolationFactor = interpolationSlider.value();
  radiusScaleFactor = radiusScaleSlider.value();
  strokeWeightValue = strokeWeightSlider.value(); // 新增：更新描边粗细值
  
  background('#85B0D4');
  
  shader(myShader);
  myShader.setUniform('u_resolution', [width, height]);
  myShader.setUniform('u_time', millis() / 1000.0);
  
  rect(-width/2, -height/2, width, height);
  
  updateQuadTree();
  quadtree.show();
  
  displayInfo();
}

function displayInfo() {
  push();
  fill(0);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(16);
  text(`插值因子: ${interpolationFactor.toFixed(2)}`, -width/2 + 10, height/2 + 70);
  text(`衰减半径缩放: ${radiusScaleFactor.toFixed(2)}`, -width/2 + 10, height/2 + 90);
  text(`描边粗细: ${strokeWeightValue.toFixed(2)}`, -width/2 + 10, height/2 + 110); // 新增：显示描边粗细信息
  pop();
}

function mousePressed() {
  if (isMouseInsideCanvas()) {
    isDragging = true;
    mouseTrail = [];
    lastMousePos = createVector(mouseX, mouseY);
    lastMouseVelocity = createVector(0, 0);
  }
}

function mouseDragged() {
  if (isDragging && isMouseInsideCanvas()) {
    let currentMousePos = createVector(mouseX, mouseY);
    let currentVelocity = p5.Vector.sub(currentMousePos, lastMousePos);
    let acceleration = p5.Vector.sub(currentVelocity, lastMouseVelocity);
    let accelerationMagnitude = acceleration.mag();

    influenceRadius = map(accelerationMagnitude, 0, 50, maxRadius, minRadius) * radiusScaleFactor;
    influenceRadius = constrain(influenceRadius, minRadius * radiusScaleFactor, maxRadius * radiusScaleFactor);

    let distanceToLast = p5.Vector.dist(currentMousePos, lastMousePos);
    let pointsToInsert = ceil(map(distanceToLast * accelerationMagnitude, 0, 1000, 1, interpolationFactor));
    
    for (let i = 0; i < pointsToInsert; i++) {
      let t = i / pointsToInsert;
      let interpolatedPos = p5.Vector.lerp(lastMousePos, currentMousePos, t);
      let interpolatedRadius = lerp(mouseTrail[mouseTrail.length - 1]?.radius || influenceRadius, influenceRadius, t);
      
      mouseTrail.push({
        pos: interpolatedPos,
        radius: interpolatedRadius
      });
    }

    lastMousePos = currentMousePos;
    lastMouseVelocity = currentVelocity;
  }
}

function mouseReleased() {
  isDragging = false;
}

function updateQuadTree() {
  let pointsToProcess = mouseTrail.slice(-100);
  for (let point of pointsToProcess) {
    if (isPointInsideCanvas(point.pos.x, point.pos.y)) {
      quadtree.subdivideAtWithRadius(point.pos.x, point.pos.y, 0, point.radius);
    }
  }

  if (isDragging && mouseTrail.length > 0 && isMouseInsideCanvas()) {
    let lastPoint = mouseTrail[mouseTrail.length - 1];
    if (lastPoint.pos.x === mouseX && lastPoint.pos.y === mouseY) {
      influenceRadius = min(influenceRadius + 5 * radiusScaleFactor, absoluteMaxRadius * radiusScaleFactor);
      mouseTrail.push({
        pos: createVector(mouseX, mouseY),
        radius: influenceRadius
      });
    }
  }
}

function createQuadTree() {
  quadtree = new QuadTree(0, 0, 1000, 2000, 0);
  subdivideQuadTree(quadtree, 0);
}

function subdivideQuadTree(qt, depth) {
  let cellWidth = width / gridWidth;
  let cellHeight = height / gridHeight;
  
  if (depth < MAX_DEPTH && (qt.boundary.w > cellWidth || qt.boundary.h > cellHeight)) {
    qt.subdivide();
    subdivideQuadTree(qt.northeast, depth + 1);
    subdivideQuadTree(qt.northwest, depth + 1);
    subdivideQuadTree(qt.southeast, depth + 1);
    subdivideQuadTree(qt.southwest, depth + 1);
  }
}

class QuadTree {
  constructor(x, y, w, h, depth) {
    this.boundary = { x, y, w, h };
    this.divided = false;
    this.depth = depth;
  }

  subdivide() {
    if (this.divided) return;
    
    let x = this.boundary.x;
    let y = this.boundary.y;
    let w = this.boundary.w / 2;
    let h = this.boundary.h / 2;

    this.northeast = new QuadTree(x + w, y, w, h, this.depth + 1);
    this.northwest = new QuadTree(x, y, w, h, this.depth + 1);
    this.southeast = new QuadTree(x + w, y + h, w, h, this.depth + 1);
    this.southwest = new QuadTree(x, y + h, w, h, this.depth + 1);

    this.divided = true;
  }

  subdivideAtWithRadius(x, y, depth, radius) {
    if (!this.intersectsCircle(x, y, radius) || depth >= MAX_DEPTH) return;

    if (!this.divided) {
      this.subdivide();
    }

    let nextRadius = radius * 0.7;
    let nextDepth = depth + 1;

    this.northeast.subdivideAtWithRadius(x, y, nextDepth, nextRadius);
    this.northwest.subdivideAtWithRadius(x, y, nextDepth, nextRadius);
    this.southeast.subdivideAtWithRadius(x, y, nextDepth, nextRadius);
    this.southwest.subdivideAtWithRadius(x, y, nextDepth, nextRadius);
  }

  intersectsCircle(cx, cy, radius) {
    let closestX = constrain(cx, this.boundary.x, this.boundary.x + this.boundary.w);
    let closestY = constrain(cy, this.boundary.y, this.boundary.y + this.boundary.h);
    let distanceX = cx - closestX;
    let distanceY = cy - closestY;
    let distanceSquared = distanceX * distanceX + distanceY * distanceY;
    return distanceSquared <= (radius * radius);
  }

  contains(x, y) {
    return (x >= this.boundary.x && x < this.boundary.x + this.boundary.w &&
            y >= this.boundary.y && y < this.boundary.y + this.boundary.h);
  }

  show() {
    stroke(0);
    strokeWeight(strokeWeightValue); // 修改：使用strokeWeightValue
    noFill();
    rectMode(CORNER);
    rect(this.boundary.x - width/2, this.boundary.y - height/2, this.boundary.w, this.boundary.h);

    if (this.divided) {
      this.northeast.show();
      this.northwest.show();
      this.southeast.show();
      this.southwest.show();
    }
  }
}

function resetSketch() {
  mouseTrail = [];
  createQuadTree();
  influenceRadius = 100 * radiusScaleFactor;
  lastMousePos = undefined;
  lastMouseVelocity = undefined;
}

function isMouseInsideCanvas() {
  return mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height;
}

function isPointInsideCanvas(x, y) {
  return x >= 0 && x < width && y >= 0 && y < height;
}

function exportSVG() {
  let svg = createSVG();
  let blob = new Blob([svg], {type: 'image/svg+xml'});
  let url = URL.createObjectURL(blob);
  let link = document.createElement('a');
  link.download = 'quadtree.svg';
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function createSVG() {
  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
  svgContent += createSVGQuadTree(quadtree);
  svgContent += '</svg>';
  return svgContent;
}

function createSVGQuadTree(qt) {
  let svgContent = '';
  let x = qt.boundary.x - width/2;
  let y = qt.boundary.y - height/2;
  let w = qt.boundary.w;
  let h = qt.boundary.h;
  
  svgContent += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="black" stroke-width="${strokeWeightValue}"/>`; // 修改：使用strokeWeightValue

  if (qt.divided) {
    svgContent += createSVGQuadTree(qt.northeast);
    svgContent += createSVGQuadTree(qt.northwest);
    svgContent += createSVGQuadTree(qt.southeast);
    svgContent += createSVGQuadTree(qt.southwest);
  }

  return svgContent;
}
