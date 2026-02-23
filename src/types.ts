export enum GameStatus {
  START = 'START',
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST',
  ROUND_END = 'ROUND_END'
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Point;
}

export interface EnemyRocket extends Entity {
  start: Point;
  target: Point;
  progress: number; // 0 to 1
  speed: number;
}

export interface InterceptorMissile extends Entity {
  start: Point;
  target: Point;
  progress: number; // 0 to 1
  speed: number;
  sourceTurretIndex: number;
}

export interface Explosion extends Entity {
  radius: number;
  maxRadius: number;
  growing: boolean;
  finished: boolean;
}

export interface Turret {
  pos: Point;
  ammo: number;
  maxAmmo: number;
  destroyed: boolean;
}

export interface City {
  pos: Point;
  destroyed: boolean;
}

export interface GameState {
  score: number;
  status: GameStatus;
  rockets: EnemyRocket[];
  missiles: InterceptorMissile[];
  explosions: Explosion[];
  turrets: Turret[];
  cities: City[];
  round: number;
  rocketsToSpawn: number;
}
