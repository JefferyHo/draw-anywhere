import { randomNumber } from "../utils/common";

interface ParticleProps {
  pos: [number, number];
  radius: number;
  color: string;
  speed: [number, number];
  lineColor: string;
}

export default class Particle {
  private count: number;
  private p: ParticleProps[];
  private cw: number;
  private ch: number;
  private ctx: CanvasRenderingContext2D;

  static LineDistance = 200;

  constructor(count: number = 100, conf: {
    width: number;
    height: number;
    ctx: CanvasRenderingContext2D;
  }) {
    this.count = count;
    this.p = [];
    this.cw = conf.width;
    this.ch = conf.height;
    this.ctx = conf.ctx;

    this.init();
  }

  init() {
    for(let i = 0; i < this.count; ++i) {
      this.p.push({
        pos: [
          randomNumber(0, this.cw), 
          randomNumber(0, this.ch)
        ],
        speed: [
          randomNumber(-6, 6) * 0.3, 
          randomNumber(-6, 6) * 0.3
        ],
        radius: 3,
        color: 'rgba(255, 255, 255, 0.6)',
        lineColor: `rgba(${randomNumber(0, 255)}, ${randomNumber(0, 255)}, ${randomNumber(0, 255)}`
      })
    }
  }

  updateBall(partical: ParticleProps) {
    const { pos, radius } = partical;
    const [x, y] = pos;
    const size = radius * 2;

    if (x + size >= this.cw || x - size <= 0) {
      partical.speed[0] = -partical.speed[0];
    }

    if (y + size >= this.ch || y - size <= 0) {
      partical.speed[1] = -partical.speed[1];
    }

    partical.pos[0] += partical.speed[0];
    partical.pos[1] += partical.speed[1];
  }

  update() {
    const list = this.p;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [x1, y1] = list[i].pos;
        const [x2, y2] = list[j].pos;
        const dis = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));

        if (dis < Particle.LineDistance) {
          this.ctx.beginPath();

          this.ctx.strokeStyle = `${list[i].lineColor}, ${(Particle.LineDistance - dis) / Particle.LineDistance})`;

          this.ctx.moveTo(...list[i].pos);
          this.ctx.lineWidth = 1;
          this.ctx.lineTo(...list[j].pos);
          this.ctx.stroke();
        }
      }

      this.drawBall(list[i]);
      this.updateBall(list[i]);
    }
  }

  drawBall(partical: ParticleProps) {
    this.ctx.beginPath();
    this.ctx.fillStyle = partical.color;
    this.ctx.arc(...partical.pos, partical.radius, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  draw() {
    this.ctx.fillStyle = "rgba(0,0,0,1)";
    this.ctx.fillRect(0, 0, this.cw, this.ch);
    this.update();

    requestAnimationFrame(this.draw.bind(this))
  }
}