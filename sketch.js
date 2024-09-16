let quadtree;
let myShader;
let isDragging = false;
let mouseTrail = [];
const MAX_DEPTH = 10;
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
let strokeWeightSlider;
let strokeWeightValue = 1;
let fullscreenButton; // 新增全屏按钮变量
let uiContainer; // 新增UI容器变量

function preload() {
  myShader = loadShader('vertex.glsl', 'fragment.glsl');
  myFont = loadFont('https://cdnjs.cloudflare.com/ajax/libs/topcoat/0.8.0/font/SourceCodePro-Bold.otf');
}

function setup() {
  createCanvas(windowWidth, windowHeight - 30, WEBGL);
  textFont(myFont);
  
  createQuadTree();
  createUIElements();
  setupUIStyles();
}

function createUIElements() {
  // 创建UI容器
  uiContainer = createDiv('');
  uiContainer.style('width', '100%');
  uiContainer.style('height', '30px'); // 减小高度
  uiContainer.style('background-color', '#2A2A2A'); // 稍微深一点的灰色
  uiContainer.style('position', 'fixed');
  uiContainer.style('bottom', '0');
  uiContainer.style('left', '0');
  uiContainer.style('display', 'flex');
  uiContainer.style('align-items', 'center');
  uiContainer.style('padding', '0 10px');

  // 创建 UI 元素
  interpolationSlider = createSlider(0, 2, interpolationFactor, 0.01);
  radiusScaleSlider = createSlider(0.2, 4, radiusScaleFactor, 0.1);
  strokeWeightSlider = createSlider(0.1, 3, strokeWeightValue, 0.1);

  resetButton = createButton('重置');
  exportSVGButton = createButton('导出 SVG');
  fullscreenButton = createButton('全屏');

  // 将UI元素添加到容器中
  let uiElements = [interpolationSlider, radiusScaleSlider, strokeWeightSlider, resetButton, exportSVGButton, fullscreenButton];
  uiElements.forEach(element => {
    element.parent(uiContainer);
    element.style('margin-right', '8px'); // 减小间距
  });
}

function setupUIStyles() {
  // 设置滑块样式
  let sliders = [interpolationSlider, radiusScaleSlider, strokeWeightSlider];
  sliders.forEach(slider => {
    slider.style('width', '100px'); // 减小宽度
    slider.style('-webkit-appearance', 'none');
    slider.style('background', '#555555'); // 更深的灰色
    slider.style('outline', 'none');
    slider.style('opacity', '0.8');
    slider.style('transition', 'opacity .2s');
    slider.style('border-radius', '8px');
    slider.style('height', '6px'); // 减小高度
  });

  // 设置滑块滑动条样式
  let sliderStyle = `
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #AAAAAA; // 浅灰色
      cursor: pointer;
    }
    input[type=range]::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #AAAAAA; // 浅灰色
      cursor: pointer;
    }
  `;
  let styleElement = createElement('style', sliderStyle);
  styleElement.parent(document.head);

  // 设置按钮样式
  let buttons = [resetButton, exportSVGButton, fullscreenButton];
  buttons.forEach(button => {
    button.style('background-color', '#555555'); // 深灰色
    button.style('border', 'none');
    button.style('color', '#FFFFFF');
    button.style('padding', '4px 8px'); // 减小内边距
    button.style('text-align', 'center');
    button.style('text-decoration', 'none');
    button.style('display', 'inline-block');
    button.style('font-size', '12px'); // 减小字体大小
    button.style('margin', '2px 1px');
    button.style('cursor', 'pointer');
    button.style('border-radius', '3px'); // 减小��角
    button.style('transition', 'background-color 0.3s');
  });

  // 添加按钮悬停效果
  buttons.forEach(button => {
    button.mouseOver(() => button.style('background-color', '#666666')); // 稍微亮一点的灰色
    button.mouseOut(() => button.style('background-color', '#555555'));
  });

  resetButton.mousePressed(resetSketch);
  exportSVGButton.mousePressed(exportSVG);
  fullscreenButton.mousePressed(toggleFullscreen);
}

function draw() {
  interpolationFactor = interpolationSlider.value();
  radiusScaleFactor = radiusScaleSlider.value();
  strokeWeightValue = strokeWeightSlider.value();
  
  background('#85B0D4');
  
  shader(myShader);
  myShader.setUniform('u_resolution', [width, height]);
  myShader.setUniform('u_time', millis() / 1000.0);
  
  // 直接绘制四叉树，不需要额外的缩放和平移
  push();
  translate(-width/2, -height/2);  // 将原点移到画布左上角
  quadtree.show();
  pop();
  
  updateQuadTree();
  
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
  text(`描边粗细: ${strokeWeightValue.toFixed(2)}`, -width/2 + 10, height/2 + 110);
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

    influenceRadius = constrain(
      map(accelerationMagnitude, 0, 50, maxRadius, minRadius) * radiusScaleFactor,
      minRadius * radiusScaleFactor,
      maxRadius * radiusScaleFactor
    );

    let distanceToLast = p5.Vector.dist(currentMousePos, lastMousePos);
    let pointsToInsert = ceil(map(distanceToLast, 0, 50, 1, interpolationFactor * 5));
    
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
    quadtree.subdivideAtWithRadius(point.pos.x, point.pos.y, 0, point.radius);
  }
  
  if (isDragging && isMouseInsideCanvas()) {
    let currentMousePos = createVector(mouseX, mouseY);
    let lastPoint = mouseTrail[mouseTrail.length - 1];
    
    if (lastPoint) {
      let distanceToLast = p5.Vector.dist(currentMousePos, lastPoint.pos);
      
      if (distanceToLast < 1) {
        // 静止状态
        influenceRadius = min(influenceRadius + radiusScaleFactor, absoluteMaxRadius * radiusScaleFactor);
      }
      
      if (distanceToLast >= 1 || influenceRadius > lastPoint.radius) {
        mouseTrail.push({
          pos: currentMousePos,
          radius: influenceRadius
        });
      }
    } else {
      // 如果 mouseTrail 为空，添加第一个点
      mouseTrail.push({
        pos: currentMousePos,
        radius: influenceRadius
      });
    }
  }
}

function createQuadTree() {
  let cellWidth = width / 20;
  let cellHeight = cellWidth * 2;
  let cols = Math.ceil(width / cellWidth);
  let rows = Math.ceil(height / cellHeight);
  let gridWidth = cols * cellWidth;
  let gridHeight = rows * cellHeight;

  quadtree = new QuadTree(0, 0, gridWidth, gridHeight, 0);
  subdivideQuadTree(quadtree, 0);
}

function subdivideQuadTree(qt, depth) {
  if (depth < MAX_DEPTH && (qt.boundary.w > 100 || qt.boundary.h > 100)) {
    qt.subdivide();
    for (let child of qt.children) {
      subdivideQuadTree(child, depth + 1);
    }
  }
}

class QuadTree {
  constructor(x, y, w, h, depth) {
    this.boundary = { x, y, w, h };
    this.divided = false;
    this.depth = depth;
    this.children = [];
  }

  subdivide() {
    if (this.divided) return false;
    
    let x = this.boundary.x;
    let y = this.boundary.y;
    let w = this.boundary.w / 2;
    let h = this.boundary.h / 2;

    this.children = [
      new QuadTree(x + w, y, w, h, this.depth + 1),
      new QuadTree(x, y, w, h, this.depth + 1),
      new QuadTree(x + w, y + h, w, h, this.depth + 1),
      new QuadTree(x, y + h, w, h, this.depth + 1)
    ];

    this.divided = true;
    return true;
  }

  subdivideAtWithRadius(x, y, depth, radius) {
    if (!this.intersectsCircle(x, y, radius) || depth >= MAX_DEPTH) return false;

    let changed = false;
    if (!this.divided) {
      changed = this.subdivide();
    }

    let nextRadius = radius * 0.7;
    let nextDepth = depth + 1;

    for (let child of this.children) {
      changed = child.subdivideAtWithRadius(x, y, nextDepth, nextRadius) || changed;
    }

    return changed;
  }

  intersectsCircle(cx, cy, radius) {
    let closestX = constrain(cx, this.boundary.x, this.boundary.x + this.boundary.w);
    let closestY = constrain(cy, this.boundary.y, this.boundary.y + this.boundary.h);
    let distanceX = cx - closestX;
    let distanceY = cy - closestY;
    let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    return distanceSquared <= (radius * radius);
  }

  contains(x, y) {
    return (x >= this.boundary.x && x < this.boundary.x + this.boundary.w &&
            y >= this.boundary.y && y < this.boundary.y + this.boundary.h);
  }

  show() {
    if (this.divided) {
      for (let child of this.children) {
        child.show();
      }
    } else if (this.isVisible()) {
      stroke(0);
      strokeWeight(strokeWeightValue);
      noFill();
      rectMode(CORNER);
      rect(this.boundary.x, this.boundary.y, this.boundary.w, this.boundary.h);
    }
  }

  isVisible() {
    return this.boundary.x < width && this.boundary.y < height &&
           this.boundary.x + this.boundary.w > 0 && this.boundary.y + this.boundary.h > 0;
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
  
  if (qt.divided) {
    for (let child of qt.children) {
      svgContent += createSVGQuadTree(child);
    }
  } else {
    let x = qt.boundary.x;
    let y = qt.boundary.y;
    let w = qt.boundary.w;
    let h = qt.boundary.h;
    svgContent += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="black" stroke-width="${strokeWeightValue}"/>`;
  }

  return svgContent;
}

// 新增全屏切换函数
function toggleFullscreen() {
  let fs = fullscreen();
  fullscreen(!fs);
}

function windowResized() {
  // 调整画布大小以匹配新的窗口大小
  resizeCanvas(windowWidth, windowHeight - 30); // 更新为新的UI容器高度
  
  // 重新创建四叉树以适应新的画布大小
  createQuadTree();
  
  // 更新UI容器宽度
  uiContainer.style('width', windowWidth + 'px');
}