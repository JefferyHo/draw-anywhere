import { throtte } from '../utils/common';
import Log from '../utils/log';

const log = Log('draw')

interface InitialConfProps {
  width?: number;
  height?: number;
}

interface InitialTriangleProps {
  type: DrawImageType;
  src: string;
  pos: [number, number, number, number];
}

interface TriangleProps extends InitialTriangleProps {
  id: number;
  movable: boolean;
  zIndex: number;
  angle: number;
  scale: [number, number];
}

interface SelectedProps {
  ind: number;
  target: TriangleProps | null;
}

interface MouseDownProps {
  status: boolean;
  x: number;
  y: number;
}

type PositionProps = [number, number];

type DrawImageType = 'IMAGE' | 'VIDEO' | 'TRIANGLE' | 'RECTANGLE' | 'OUTLINE';

type MouseGesture = 'move' | 'rotate' | 'scale' | null;

export default class Draw {
  private _canvas: HTMLCanvasElement;
  private _canvas_offscreen: HTMLCanvasElement;
  private _scale: number;
  private _context: CanvasRenderingContext2D;
  private _context_offscreen: CanvasRenderingContext2D;
  private _w: number;
  private _h: number;

  private _outline_color: string;

  private _list: TriangleProps[];

  private throtteDraw: () => void;

  static RotateAmp: number = 1;
  static BorderPadding: number = 2;

  static RotateLineLength: number = 30;
  static BorderLineWidth: number = 2;
  static BorderPointArc: number = 10;

  private _mouse_down: MouseDownProps;

  private _rotation_radius: number;

  private _indexMax: number;

  private _image_cache: {[_:string]: HTMLImageElement};

  private _selected: SelectedProps;

  private action: MouseGesture;

  constructor(canvas: HTMLCanvasElement, conf: InitialConfProps = {
    width: 1920 * 2,
    height: 1080 * 2
  }) {
    this._canvas = canvas;
    this._context = canvas.getContext('2d') as CanvasRenderingContext2D;

    this._w = conf.width || 1920;
    this._h = conf.height || 1080;

    this._scale = 1;

    this._list = [];
    
    this.throtteDraw = throtte(this._resize.bind(this), 100);
    window.addEventListener('resize', this.throtteDraw);
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    this._canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this._canvas.addEventListener('mousemove', throtte(this.handleMouseMove.bind(this), 10));
    this._canvas.addEventListener('mouseout', this.handleMouseUp.bind(this));
    this._canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));

    this._canvas.height = this._canvas.clientHeight;
    this._canvas.width = this._canvas.clientWidth;

    // offscreen canvas
    this._canvas_offscreen = document.createElement('canvas');
    this._context_offscreen = this._canvas_offscreen.getContext('2d') as CanvasRenderingContext2D;
    
    this._canvas_offscreen.width = this._canvas.clientWidth;
    this._canvas_offscreen.height = this._canvas.clientHeight;

    this._outline_color = '#a00';

    this._mouse_down = {
      status: false,
      x: 0,
      y: 0
    }

    this._rotation_radius = 4;
    this._indexMax = 0;

    this._image_cache = {};
    this._selected = {
      ind: -1,
      target: null
    };

    this.action = null;

    this._resize();
  }

  changeResolution(w: number, h: number) {
    this._w = w;
    this._h = h;
    this._resize();
  }

  private _scaleCalulate() {
    return Math.floor(Math.min(this._canvas.clientWidth / this._w, this._canvas.clientHeight / this._h) * 100) / 100;
  }

  private _resize() {
    this._canvas.height = this._canvas.clientHeight;
    this._canvas.width = this._canvas.clientWidth;
    this._canvas_offscreen.height = this._canvas.clientHeight;
    this._canvas_offscreen.width = this._canvas.clientWidth;

    this._scale = this._scaleCalulate();
    log.info('scale', this._scale);
    this.draw();
  }

  private _getters<T>(obj: {
    [_: string]: any
  }, key: string, _default: T) {
    if (obj.hasOwnProperty(key)) {
      return obj[key];
    }

    return _default as T;
  }

  addBuilder(config: InitialTriangleProps): TriangleProps {
    return {
      id: Date.now(),
      movable: this._getters(config, 'movable', true),
      zIndex: this._indexMax++,
      type: config.type,
      src: config.src || '',
      angle: 0,
      scale: [1, 1],
      pos: this._getters(config, 'pos', [0, 0, 0, 0]),
    };
  }

  add(config: InitialTriangleProps) {
    const id = Date.now();

    this._list.push(this.addBuilder(config));

    log.info(`add one [ ${id} ]`)

    this._resize();

    return id;
  }

  remove(id: number) {
    this._list.splice(this._list.findIndex(({ id: eId }) => eId === id), 1);

    this._resize();
  }

  private _loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      if (this._image_cache[src]) {
        resolve(this._image_cache[src]);
        return;
      }

      const img = new Image();
      img.onload = () => {
        this._image_cache[src] = img;
        resolve(img);
      }
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  }

  private _getPointAndCenter(elem: TriangleProps) {
    return {
      polygon: this._getPoint(elem),
      center: this._getImgCenter(elem)
    };
  }

  // 获取矩形中心点
  private _getImgCenter(elem: TriangleProps): PositionProps {
    const { pos: [x, y, w, h] } = elem;
    return [(x + w / 2), (y + h / 2)];
  }

  // 获取矩形顶点
  private _getPoint(ele: TriangleProps): PositionProps[] {
    const { pos: [x, y, width, height ] } = ele;

    return [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height]
    ];
  }

  async drawImage(ele: TriangleProps) {
    const ctx = this._context_offscreen;

    const _img = await this._loadImg(ele.src as string);
    if (ele.pos[2] === 0) {
      ele.pos[2] = _img.width;
      ele.pos[3] = _img.height;
    }

    ctx.save();

    const [sx, sy] = ele.scale;
    ctx.scale(sx * this._scale, sy * this._scale);

    const [centex, centery] = this._getImgCenter(ele);
    ctx.translate(centex, centery);
    ctx.rotate(ele.angle * Draw.RotateAmp);

    const [w, h] = ele.pos.slice(2);
    ctx?.drawImage(
      _img, 
      -0.5 * w, -0.5 * h,
      w, h
    );

    ctx.translate(-centex, -centery);

    if (this._selected.target?.id === ele.id) {
      this._draw_outer_helper(ele);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();

  }

  private _getNormal(p1: PositionProps, p2: PositionProps) {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const length = Math.sqrt(dx * dx + dy * dy);
    return [-dy / length, dx / length];  // 旋转 90 度得到法线
  }

  /**
   * 计算多边形向外延伸点，绘制外框和移动判断
   * 
   * @param polygon 多边形顶点
   * @param offset [offset=2] 偏移
   * 
   * @returns
   * */ 
  private _getOuterPoints(polygon: PositionProps[], offset: number = Draw.BorderPadding): PositionProps[] {
    const n = polygon.length;
    const outline: PositionProps[] = [];

    for (let i = 0; i < n; i++) {
      // 当前点
      const current = polygon[i];
      // 前一个点
      const prev = polygon[(i - 1 + n) % n];
      // 后一个点
      const next = polygon[(i + 1) % n];

      // 计算两条边的法线
      const normal1 = this._getNormal(prev, current);
      const normal2 = this._getNormal(current, next);

      // 平均法线方向并归一化
      const normal = [
          (normal1[0] + normal2[0]) / 2,
          (normal1[1] + normal2[1]) / 2
      ];
      const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1]);
      const unitNormal = [normal[0] / length, normal[1] / length];

      // 将当前点沿法线方向移动
      const newX = current[0] + unitNormal[0] * offset;
      const newY = current[1] + unitNormal[1] * offset;

      outline.push([newX, newY]);
    }
    return outline;
  }

  private _getSelected() {
    return this._list.find((item => this._selected.target?.id === item.id));
  }

  handleMouseUp(e: MouseEvent) {
    this._mouse_down.status = false;
  }

  private _calculateRotateAngle(center: PositionProps, pointA: PositionProps, pointB: PositionProps) {
    // 计算向量 CA 和 CB
    const ax = pointA[0] - center[0], ay = pointA[1] - center[1];
    const bx = pointB[0]- center[0], by = pointB[1] - center[1];

    // 计算向量 CA 和 CB 的点积和叉积
    // const dotProduct = ax * bx + ay * by;
    // const crossProduct = ax * by - ay * bx;

    // // 计算角度，使用 Math.atan2 处理角度方向
    const angle_a = Math.atan2(ay, ax);
    const angle_b = Math.atan2(by, bx);
    // const angle = Math.atan2(ay, ax);
    let delta = angle_b - angle_a;

    return delta;
  }

  private _handleScale(pos1: PositionProps, elem: TriangleProps) {
    let { pos: [x, y, w, h] } = elem;
    const [px, py] = this._caculatePointVarAngle(pos1, this._getImgCenter(elem), elem.angle);

    switch (this._selected.ind) {
      case 0: // 左上角
          w += x - px;
          h += y - py;
          x = px;
          y = py;
          break;
      case 1: // 右上角
          w = px - x;
          h += y - py;
          y = py;
          break;
      case 3: // 左下角
          w += x - px;
          h = py - y;
          x = px;
          break;
      case 2: // 右下角
          w = px - x;
          h = py - y;
          break;
    }

    elem.pos = [x, y, w, h];
    elem.scale = [this._toFixed(w / elem.pos[2]), this._toFixed(h / elem.pos[3])];
  }

  private _toFixed(num: number, precison: number = 2) {
    return Math.round(num * Math.pow(10, precison)) / Math.pow(10, precison);
  }

  handleMouseMove(e: MouseEvent) {
    if (
      e.offsetX < 0
      || e.offsetY < 0
      || e.offsetX > this._canvas.width
      || e.offsetY > this._canvas.height
    ) {
      this._mouse_down.status = false;
      return;
    }

    if (this._mouse_down.status === false) return;

    const update = () => {
      const _selected = this._getSelected();
      if (!_selected) return;

      const offsetX = e.offsetX - this._mouse_down.x;
      const offsetY = e.offsetY - this._mouse_down.y;

      if (this.action === 'rotate') {

        let _angle = this._calculateRotateAngle(this._getImgCenter(this._selected.target as TriangleProps), [this._mouse_down.x, this._mouse_down.y], [e.offsetX, e.offsetY])
        
        _selected.angle = (_selected.angle + _angle) % (2 * Math.PI);
      } else if (this.action === 'move') {
        _selected.pos[0] += offsetX / this._scale;
        _selected.pos[1] += offsetY / this._scale;
      } else if (this.action === 'scale') {
        const [x, y] = [e.offsetX / this._scale, e.offsetY / this._scale];

        this._handleScale([x, y], _selected);
      }

      this._mouse_down.x = e.offsetX;
      this._mouse_down.y = e.offsetY;
      requestAnimationFrame(this.draw.bind(this));
    }

    update();
  }

  handleMouseDown(e: MouseEvent) {
    this._mouse_down.status = true;
    this._mouse_down.x = e.offsetX;
    this._mouse_down.y = e.offsetY;

    this._checkSelect(e.offsetX / this._scale, e.offsetY / this._scale);

    if (!this._selected.target) {
      this._mouse_down.status = false;
    }

    this.draw();
  }

  handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const ind = this._list.findIndex((ll) => ll.id === this._selected.target?.id);

      if (ind >= 0) {
        this._list.splice(ind, 1);

        this.draw();
      }
    }
  }

  private _sort() {
    this._list.sort((e1, e2) => e1.zIndex - e2.zIndex);
  }

  // 
  private _caculatePointVarAngle(point: PositionProps, center: PositionProps, angle: number = 0): PositionProps {
    if (angle === 0) return point;

    const dx = point[0] - center[0];
    const dy = point[1] - center[1];

    return [dx * Math.cos(-angle) - dy * Math.sin(-angle) + center[0],
      dx * Math.sin(-angle) + dy * Math.cos(-angle) + center[1],
    ];
  }

  /**
   * 判断坐标是否在多边形内部
   * 
   * @param { [number, number][] } polygon 多边形顶点坐标
   * @param { number } x 坐标x
   * @param { number } y 坐标y
   * 
   * @returns { boolean }
   * */ 
  private _isPointInPolygon(elem: TriangleProps, pos: PositionProps): boolean {
    const { angle } = elem;
    const { polygon, center } = this._getPointAndCenter(elem);

    // 重新交互点
    const [x, y] = this._caculatePointVarAngle(pos, center, angle * Draw.RotateAmp);

    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];

        const intersect = ((yi > y) !== (yj > y)) &&
                          (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * 判断坐标是否在旋转交互点
   * 
   * @param center 圆心坐标
   * @param radius 圆半径
   * @param pos 目标坐标
   * 
   * @returns { boolean }
   * */ 
  private _isPointOnRotate(elem: TriangleProps, pos: PositionProps) {
    const { angle } = elem;
    const { polygon, center } = this._getPointAndCenter(elem);
    const _pos = this._icon_point_rotate(polygon);
    const c = this._caculatePointVarAngle(pos, center, angle);

    return Math.pow(_pos[0] - c[0], 2) + Math.pow(_pos[1] - c[1], 2) <= Draw.BorderPointArc * Draw.BorderPointArc;
  }

  /**
   * 获取交互点在缩放交互点中的索引
   * 
   * @param center 圆心坐标
   * @param radius 圆半径
   * @param pos 目标坐标
   * 
   * @returns { number }
   * */ 
  private _getIndexOnBorderPoint(elem: TriangleProps, pos: PositionProps) {
    const { angle } = elem;
    const { polygon, center } = this._getPointAndCenter(elem);
    const _pos = this._caculatePointVarAngle(pos, center, angle);

    for(let i = 0; i < polygon.length; i++) {
      const p = polygon[i];
      if (Math.pow(p[0] - _pos[0], 2) + Math.pow(p[1] - _pos[1], 2) <= Draw.BorderPointArc * Draw.BorderPointArc) {
        return i;
      }
    }

    return -1;
  }

  /**
   * 计算多边形中心点
   * 
   * @param vertices 多边形顶点
   * 
   * @returns { PositionProps } 多边形中心点
   * */ 
  private _calculateCentroid(vertices: PositionProps[]): PositionProps {
    let xSum = 0, ySum = 0;
    let area = 0;
    const n = vertices.length;

    for (let i = 0; i < n; i++) {
      const x0 = vertices[i][0];
      const y0 = vertices[i][1];
      const x1 = vertices[(i + 1) % n][0];
      const y1 = vertices[(i + 1) % n][1];

      const crossProduct = (x0 * y1) - (x1 * y0);
      area += crossProduct;
      xSum += (x0 + x1) * crossProduct;
      ySum += (y0 + y1) * crossProduct;
    }

    area = area / 2;
    const Cx = xSum / (6 * area);
    const Cy = ySum / (6 * area);

    return [Cx, Cy];
  }

  private _isPointOnBorder(points: PositionProps[], pos: PositionProps, tolerance = Draw.BorderPadding * 2) {
    return false;
  }

  private _checkSelect(x: number, y: number) {
    this._selected = {
      ind: -1,
      target: null
    };

    for(let i = this._list.length - 1; i >= 0; i--) {
      const elem = this._list[i];
      if (!elem.movable) continue;
      // console.log(x, y, elem.polygon)

      if (this._isPointOnRotate(elem, [x, y])) {
        this._selected.target = elem;
        this.action = 'rotate';
        break;
      }

      const _scaleIndex = this._getIndexOnBorderPoint(elem, [x, y]);
      if (_scaleIndex >= 0) {
        this._selected.target = elem;
        this._selected.ind = _scaleIndex;
        this.action = 'scale';
        break;
      }

      if (this._isPointInPolygon(elem, [x, y])) {
        this._selected.target = elem;

        if (this._selected.target.zIndex !== this._indexMax) {
          this._selected.target.zIndex = ++this._indexMax;
        }

        this.action = 'move';
        break;
      }
    }
  }

  async draw() {
    if (this._context === null) {
      log.warn('Not support canvas context');
      return;
    }

    this._context_offscreen.clearRect(0, 0, this._canvas_offscreen.width, this._canvas_offscreen.height);

    log.info('exec')
    this._sort();
    for(let elem of this._list) {
      switch(elem.type) {
        case 'IMAGE': await this.drawImage(elem); break;
        default: this.drawImage(elem);
      }
    }

    this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    if (this._canvas_offscreen.width > 0 && this._canvas_offscreen.height > 0) {
      this._context.drawImage(this._canvas_offscreen, 0, 0);
    }
  }

  /**
   * 点击判断，是否在旋转标示内
  */
 private _is_select_rotation() {

 }
  private _draw_outer_helper(elem: TriangleProps) {
    const points = this._getPoint(elem);
    const ctx = this._context_offscreen;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillStyle = '#00f';

    // points
    for(let i = 0; i < points.length; i++) {
      let [x, y] = points[i];
      ctx.beginPath();
      ctx.arc(x, y, Draw.BorderPointArc, 0, 2 * Math.PI);
      ctx.fill();
    }

    // lines
    for(let i = 0; i < points.length; i++) {
      let [x, y] = points[i];
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      ctx.lineWidth = Draw.BorderLineWidth;
    }

    ctx.closePath();

    const _x = ((points[1][0] - points[0][0]) / 2 + points[0][0]);
    const _y = ((points[1][1] - points[0][1]) / 2 + points[0][1]);
    const [_x1, _y1] = this._icon_point_rotate(points);

    ctx.moveTo(_x, _y);
    ctx.lineTo(_x, _y1);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(_x, _y1, Draw.BorderPointArc, 0, 2 * Math.PI);
    ctx.fill();
  }

  // 旋转图标点
  private _icon_point_rotate(points: PositionProps[], scale: number = 1): PositionProps {
    const _x = ((points[1][0] - points[0][0]) / 2 + points[0][0]) * scale;
    const _y = ((points[1][1] - points[0][1]) / 2 + points[0][1]) * scale;

    return [_x, _y - Draw.RotateLineLength * scale];
  }


  clear() {
    window.removeEventListener('resize', this.throtteDraw);
  }
}