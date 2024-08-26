import { throtte } from '../utils/common';
import Log from '../utils/log';

const log = Log('draw')

interface InitialConfProps {
  width?: number;
  height?: number;
}

interface DrawElemBaseProps {
  type: DrawImageType;
  src?: string;
  pos?: PositionProps;
}

interface AddDrawElementProps extends DrawElemBaseProps {
  center: PositionProps;
  movable: boolean;
  zIndex: number;
  polygon: PositionProps[];
  selected: boolean;
  angle: number;
  scale: number;
  pos: PositionProps;
  action: MouseGesture;
}

interface DrawImageProps extends AddDrawElementProps{
  id: number;
  zIndex: number;
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

  private _list: DrawImageProps[];

  private throtteDraw: () => void;

  static RotateAmp: number = 0.04;
  static BorderPadding: number = 2;

  private _mouse_down: MouseDownProps;

  private _rotation_radius: number;

  private _indexMax: number;

  constructor(canvas: HTMLCanvasElement, conf: InitialConfProps = {
    width: 1920,
    height: 1080
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
    this._canvas.addEventListener('mousemove', throtte(this.handleMouseMove.bind(this), 30));
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
    // this.draw();
  }

  private _getters<T>(obj: {
    [_: string]: any
  }, key: string, _default: T) {
    if (obj.hasOwnProperty(key)) {
      return obj[key];
    }

    return _default as T;
  }

  addBuilder(config: AddDrawElementProps): DrawImageProps {
    return {
      id: Date.now(),
      movable: this._getters(config, 'movable', true),
      zIndex: config.zIndex || this._indexMax++,
      type: config.type,
      src: config.src || '',
      selected: false,
      polygon: [],
      center: [0, 0],
      angle: 0,
      action: null,
      scale: 1,
      pos: this._getters(config, 'pos', [0, 0])
    };
  }

  add(config: DrawElemBaseProps) {
    const id = Date.now();

    this._list.push(this.addBuilder(config as AddDrawElementProps));

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
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  }

  async drawImage(ele: DrawImageProps) {
    const ctx = this._context_offscreen;

    const _img = await this._loadImg(ele.src as string);

    const [left, top] = ele.pos;
    ele.polygon = [
      [left, top],
      [left, (top + _img.height)],
      [(left + _img.width), (top + _img.height)],
      [(left + _img.width), top],
    ];

    ele.center = this._calculateCentroid(ele.polygon);

    ctx.save();
    ctx.translate(ele.center[0] * this._scale, ele.center[1] * this._scale);
    // ctx.moveTo(ele.center[0] * this._scale, ele.center[1] * this._scale);
    ctx.rotate(ele.angle * Draw.RotateAmp);
    // ctx.rotate(count++ * 30);
    ctx?.drawImage(
      _img, 
      -0.5 * _img.width * this._scale, -0.5 * _img.height * this._scale,
      _img.width * this._scale, _img.height * this._scale
    );
    this.drawPolygonWithOutline(ele, 1, ele.selected ? '#f00' : 'rgba(200, 200, 200, 0.5)')
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();

    ele.selected && this._helper_rotate_icon(left + _img.width / 2, top + _img.height / 2);
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

  /**
   * 绘制多边形外框
   * 
   * @param polygon 多边形顶点
   * @param offset [offset=2] 偏移
   * 
   * @returns
   * */ 
  drawPolygonWithOutline(elem: DrawImageProps, offset: number = Draw.BorderPadding, color: string = this._outline_color) {
    const outline = this._getOuterPoints(elem.polygon, offset);

    // 绘制外框
    this._context_offscreen.beginPath();
    this._context_offscreen.moveTo((outline[0][0] - elem.center[0]) * this._scale, (outline[0][1] - elem.center[1]) * this._scale);
    for (let i = 1; i < outline.length; i++) {
      this._context_offscreen.lineTo((outline[i][0] - elem.center[0]) * this._scale, (outline[i][1] - elem.center[1]) * this._scale);
    }
    this._context_offscreen.closePath();
    this._context_offscreen.strokeStyle = color;
    this._context_offscreen.setLineDash([5, 10]);
    this._context_offscreen.stroke();
    this._context_offscreen.setLineDash([]);
  }

  private _getSelected() {
    return this._list.find((item => item.selected));
  }

  handleMouseUp(e: MouseEvent) {
    this._mouse_down.status = false;
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

      if (_selected.action === 'rotate') {
        let _angle = _selected.angle;

        let angle = Math.atan2(e.offsetY - this._mouse_down.y, e.offsetX - this._mouse_down.x);

        // angle = Math.abs(angle)

        _angle += angle;

        _selected.angle = _angle;
      } else if (_selected.action === 'move') {
        _selected.pos[0] += offsetX / this._scale;
        _selected.pos[1] += offsetY / this._scale;
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
    console.log(e.offsetX, e.offsetY, this._scale);
    console.log(e.offsetX / this._scale, e.offsetY / this._scale);

    const _prev_selected = this._getSelected();

    if (_prev_selected) {
      _prev_selected.selected = false;
    }

    const _elem: AddDrawElementProps | undefined = this._checkSelect(e.offsetX / this._scale, e.offsetY / this._scale);

    if (_elem) {
      _elem.selected = true;
    }

    if (!this._getSelected()) {
      this._mouse_down.status = false;
    }

    this.draw();
  }

  handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const ind = this._list.findIndex((ll) => ll.selected);
      console.log(ind)

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
  private _caculatePointVarAngle(points: PositionProps[], center: PositionProps, angle: number = 0): PositionProps[] {
    if (angle === 0) return points;

    const _p: PositionProps[] = points.map((p: PositionProps) => ([
      (p[0] - center[0]) * Math.cos(angle) - (p[1] - center[1]) * Math.sin(angle) + center[0],
      (p[0] - center[0]) * Math.sin(angle) + (p[1] - center[1]) * Math.cos(angle) + center[1],
    ]));

    return this._getOuterPoints(_p, Draw.BorderPadding);
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
  private _isPointInPolygon(elem: AddDrawElementProps, pos: PositionProps): boolean {
    const { angle, center } = elem;

    // 重新计算多边形的顶点
    const polygon = this._caculatePointVarAngle(elem.polygon, center, angle * Draw.RotateAmp);
    // elem.polygon = { ...polygon };
    // console.log(elem.polygon, angle, pos, center);
    // console.log(polygon);

    let inside = false;
    const n = polygon.length;
    const [x, y] = pos;

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
   * 判断坐标是否在圆内部
   * 
   * @param center 圆心坐标
   * @param radius 圆半径
   * @param pos 目标坐标
   * 
   * @returns { boolean }
   * */ 
  private _isPointInCircle(center: PositionProps, radius: number, pos: PositionProps) {
    return Math.pow(pos[0] - center[0], 2) + Math.pow(pos[1] - center[1], 2) <= radius * radius;
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
    let _selected;
    for(let i = this._list.length - 1; i >= 0; i--) {
      const elem = this._list[i];
      if (!elem.movable) continue;
      // console.log(x, y, elem.polygon)

      if (!elem.polygon) continue;

      if (this._isPointInPolygon(elem, [x, y])) {
        _selected = elem;

        if (_selected.zIndex !== this._indexMax) {
          _selected.zIndex = ++this._indexMax;
        }

        if (this._isPointOnBorder(elem.polygon, [x, y])) {
          _selected.action = 'scale';
          break;
        }

        if (this._isPointInCircle(elem.center, this._rotation_radius * 2 / this._scale, [x, y])) {
          _selected.action = 'rotate';
          break;
        }

        _selected.action = 'move';
        break;
      }
    }

    return _selected;
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

    // this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    this._context.drawImage(this._canvas_offscreen, 0, 0);
  }

  /**
   * 点击判断，是否在旋转标示内
  */
 private _is_select_rotation() {

 }

  /**
   * 绘制辅助类：可旋转标示
   * */ 
  private _helper_rotate_icon(_x: number, _y: number, color: string = '#f00') {
    const ctx = this._context_offscreen;
    const x = _x * this._scale;
    const y = _y * this._scale;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    const radius = this._rotation_radius;
    const radiusOuter = radius * 2;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, radiusOuter, - 1 / 6 * Math.PI, 4 / 6 * Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + radiusOuter * Math.cos(4 / 6 * Math.PI), y + radiusOuter * Math.sin(4 / 6 * Math.PI), 1, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + radiusOuter * Math.cos(10 / 6 * Math.PI), y + radiusOuter * Math.sin(10 / 6 * Math.PI), 1, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, radiusOuter, 5 / 6 * Math.PI, 10 / 6 * Math.PI);
    ctx.stroke();
  }

  clear() {
    window.removeEventListener('resize', this.throtteDraw);
  }
}