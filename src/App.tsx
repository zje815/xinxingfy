/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { 
  GameStatus, 
  GameState, 
  Point, 
  EnemyRocket, 
  InterceptorMissile, 
  Explosion, 
  Turret, 
  City 
} from './types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  EXPLOSION_MAX_RADIUS, 
  EXPLOSION_GROWTH_SPEED, 
  MISSILE_SPEED, 
  ROCKET_SPEED_BASE, 
  ROCKET_SPEED_INC, 
  WIN_SCORE, 
  TURRET_AMMO, 
  COLORS 
} from './constants';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameStatus>(GameStatus.START);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');

  // Game engine refs to avoid re-renders
  const stateRef = useRef<GameState>({
    score: 0,
    status: GameStatus.START,
    rockets: [],
    missiles: [],
    explosions: [],
    turrets: [],
    cities: [],
    round: 1,
    rocketsToSpawn: 3
  });

  const requestRef = useRef<number>(null);

  const initGame = useCallback(() => {
    const turrets: Turret[] = [
      { pos: { x: 50, y: CANVAS_HEIGHT - 40 }, ammo: TURRET_AMMO[0], maxAmmo: TURRET_AMMO[0], destroyed: false },
      { pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 40 }, ammo: TURRET_AMMO[1], maxAmmo: TURRET_AMMO[1], destroyed: false },
      { pos: { x: CANVAS_WIDTH - 50, y: CANVAS_HEIGHT - 40 }, ammo: TURRET_AMMO[2], maxAmmo: TURRET_AMMO[2], destroyed: false },
    ];

    const cities: City[] = [
      { pos: { x: 150, y: CANVAS_HEIGHT - 20 }, destroyed: false },
      { pos: { x: 250, y: CANVAS_HEIGHT - 20 }, destroyed: false },
      { pos: { x: 350, y: CANVAS_HEIGHT - 20 }, destroyed: false },
      { pos: { x: 450, y: CANVAS_HEIGHT - 20 }, destroyed: false },
      { pos: { x: 550, y: CANVAS_HEIGHT - 20 }, destroyed: false },
      { pos: { x: 650, y: CANVAS_HEIGHT - 20 }, destroyed: false },
    ];

    stateRef.current = {
      score: 0,
      status: GameStatus.PLAYING,
      rockets: [],
      missiles: [],
      explosions: [],
      turrets,
      cities,
      round: 1,
      rocketsToSpawn: 3
    };
    setScore(0);
    setRound(1);
    setGameState(GameStatus.PLAYING);
  }, []);

  const nextRound = useCallback(() => {
    const state = stateRef.current;
    
    // Bonus points for remaining ammo
    let ammoBonus = 0;
    state.turrets.forEach(t => {
      if (!t.destroyed) {
        ammoBonus += t.ammo * 5;
        t.ammo = t.maxAmmo; // Refill
      }
    });
    
    state.score += ammoBonus;
    setScore(state.score);

    state.round += 1;
    state.rocketsToSpawn = 3 + state.round * 1;
    state.status = GameStatus.PLAYING;
    setRound(state.round);
    setGameState(GameStatus.PLAYING);
  }, []);

  const spawnRocket = useCallback(() => {
    const state = stateRef.current;
    if (state.status !== GameStatus.PLAYING || state.rocketsToSpawn <= 0) return;

    state.rocketsToSpawn--;
    const start: Point = { x: Math.random() * CANVAS_WIDTH, y: 0 };
    
    // Target either a city or a turret
    const targets = [...state.cities.filter(c => !c.destroyed), ...state.turrets.filter(t => !t.destroyed)];
    if (targets.length === 0) return;
    
    const targetEntity = targets[Math.floor(Math.random() * targets.length)];
    const target: Point = { ...targetEntity.pos };

    const newRocket: EnemyRocket = {
      id: Math.random().toString(36).substr(2, 9),
      pos: { ...start },
      start,
      target,
      progress: 0,
      speed: ROCKET_SPEED_BASE + (state.round - 1) * ROCKET_SPEED_INC + Math.random() * 0.0005
    };

    state.rockets.push(newRocket);
  }, []);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (stateRef.current.status !== GameStatus.PLAYING) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Find closest turret with ammo
    let bestTurretIndex = -1;
    let minDist = Infinity;

    stateRef.current.turrets.forEach((t, i) => {
      if (!t.destroyed && t.ammo > 0) {
        const dist = Math.abs(t.pos.x - x);
        if (dist < minDist) {
          minDist = dist;
          bestTurretIndex = i;
        }
      }
    });

    if (bestTurretIndex !== -1) {
      const turret = stateRef.current.turrets[bestTurretIndex];
      turret.ammo--;
      
      const missile: InterceptorMissile = {
        id: Math.random().toString(36).substr(2, 9),
        pos: { ...turret.pos },
        start: { ...turret.pos },
        target: { x, y },
        progress: 0,
        speed: MISSILE_SPEED,
        sourceTurretIndex: bestTurretIndex
      };
      stateRef.current.missiles.push(missile);
    }
  };

  const update = useCallback(() => {
    const state = stateRef.current;
    if (state.status !== GameStatus.PLAYING) return;

    // 1. Update Rockets
    state.rockets.forEach((r, index) => {
      r.progress += r.speed;
      r.pos.x = r.start.x + (r.target.x - r.start.x) * r.progress;
      r.pos.y = r.start.y + (r.target.y - r.start.y) * r.progress;

      if (r.progress >= 1) {
        // Hit target
        state.explosions.push({
          id: Math.random().toString(36).substr(2, 9),
          pos: { ...r.target },
          radius: 0,
          maxRadius: EXPLOSION_MAX_RADIUS,
          growing: true,
          finished: false
        });

        // Check what was hit
        state.cities.forEach(c => {
          if (!c.destroyed && Math.abs(c.pos.x - r.target.x) < 10 && Math.abs(c.pos.y - r.target.y) < 10) {
            c.destroyed = true;
          }
        });
        state.turrets.forEach(t => {
          if (!t.destroyed && Math.abs(t.pos.x - r.target.x) < 20 && Math.abs(t.pos.y - r.target.y) < 20) {
            t.destroyed = true;
          }
        });

        state.rockets.splice(index, 1);
      }
    });

    // 2. Update Missiles
    state.missiles.forEach((m, index) => {
      m.progress += m.speed;
      m.pos.x = m.start.x + (m.target.x - m.start.x) * m.progress;
      m.pos.y = m.start.y + (m.target.y - m.start.y) * m.progress;

      if (m.progress >= 1) {
        state.explosions.push({
          id: Math.random().toString(36).substr(2, 9),
          pos: { ...m.target },
          radius: 0,
          maxRadius: EXPLOSION_MAX_RADIUS,
          growing: true,
          finished: false
        });
        state.missiles.splice(index, 1);
      }
    });

    // 3. Update Explosions
    state.explosions.forEach((e, index) => {
      if (e.growing) {
        e.radius += EXPLOSION_GROWTH_SPEED;
        if (e.radius >= e.maxRadius) e.growing = false;
      } else {
        e.radius -= EXPLOSION_GROWTH_SPEED;
        if (e.radius <= 0) e.finished = true;
      }

      if (e.finished) {
        state.explosions.splice(index, 1);
      } else {
        // Check collision with rockets
        state.rockets.forEach((r, rIdx) => {
          const dist = Math.sqrt((r.pos.x - e.pos.x) ** 2 + (r.pos.y - e.pos.y) ** 2);
          if (dist < e.radius) {
            state.score += 20;
            setScore(state.score);
            state.explosions.push({
              id: Math.random().toString(36).substr(2, 9),
              pos: { ...r.pos },
              radius: 0,
              maxRadius: EXPLOSION_MAX_RADIUS / 2,
              growing: true,
              finished: false
            });
            state.rockets.splice(rIdx, 1);
          }
        });
      }
    });

    // 4. Check Game Over / Win / Round End
    const allTurretsDestroyed = state.turrets.every(t => t.destroyed);
    if (allTurretsDestroyed) {
      state.status = GameStatus.LOST;
      setGameState(GameStatus.LOST);
    }

    if (state.score >= WIN_SCORE) {
      state.status = GameStatus.WON;
      setGameState(GameStatus.WON);
      return;
    }

    // Check Round End
    if (state.rocketsToSpawn === 0 && state.rockets.length === 0 && state.explosions.length === 0) {
      state.status = GameStatus.ROUND_END;
      setGameState(GameStatus.ROUND_END);
    }

    // Spawn rockets logic
    if (state.rocketsToSpawn > 0 && Math.random() < 0.007 + (state.round * 0.002)) {
      spawnRocket();
    }
  }, [spawnRocket]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;

    // Clear
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Ground
    ctx.fillStyle = COLORS.GROUND;
    ctx.fillRect(0, CANVAS_HEIGHT - 10, CANVAS_WIDTH, 10);

    // Draw Cities
    state.cities.forEach(c => {
      if (!c.destroyed) {
        ctx.fillStyle = COLORS.CITY;
        ctx.fillRect(c.pos.x - 15, c.pos.y - 15, 30, 15);
        // Windows
        ctx.fillStyle = '#fde047';
        ctx.fillRect(c.pos.x - 10, c.pos.y - 12, 4, 4);
        ctx.fillRect(c.pos.x + 6, c.pos.y - 12, 4, 4);
      }
    });

    // Draw Turrets
    state.turrets.forEach(t => {
      if (!t.destroyed) {
        ctx.fillStyle = COLORS.TURRET;
        ctx.beginPath();
        ctx.moveTo(t.pos.x - 20, t.pos.y);
        ctx.lineTo(t.pos.x + 20, t.pos.y);
        ctx.lineTo(t.pos.x, t.pos.y - 30);
        ctx.closePath();
        ctx.fill();
        
        // Ammo bar
        const ammoWidth = 40 * (t.ammo / t.maxAmmo);
        ctx.fillStyle = '#374151';
        ctx.fillRect(t.pos.x - 20, t.pos.y + 5, 40, 4);
        ctx.fillStyle = COLORS.TURRET;
        ctx.fillRect(t.pos.x - 20, t.pos.y + 5, ammoWidth, 4);
      }
    });

    // Draw Rockets
    state.rockets.forEach(r => {
      ctx.strokeStyle = COLORS.ROCKET;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(r.start.x, r.start.y);
      ctx.lineTo(r.pos.x, r.pos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS.ROCKET;
      ctx.beginPath();
      ctx.arc(r.pos.x, r.pos.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Missiles
    state.missiles.forEach(m => {
      ctx.strokeStyle = COLORS.MISSILE;
      ctx.beginPath();
      ctx.moveTo(m.start.x, m.start.y);
      ctx.lineTo(m.pos.x, m.pos.y);
      ctx.stroke();

      // Target X
      ctx.strokeStyle = COLORS.MISSILE;
      ctx.beginPath();
      ctx.moveTo(m.target.x - 5, m.target.y - 5);
      ctx.lineTo(m.target.x + 5, m.target.y + 5);
      ctx.moveTo(m.target.x + 5, m.target.y - 5);
      ctx.lineTo(m.target.x - 5, m.target.y + 5);
      ctx.stroke();
    });

    // Draw Explosions
    state.explosions.forEach(e => {
      ctx.fillStyle = COLORS.EXPLOSION;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
    });

  }, []);

  const gameLoop = useCallback(() => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameLoop]);

  const t = {
    zh: {
      title: 'Tina新星防御',
      start: '开始游戏',
      score: '得分',
      round: '波次',
      roundEnd: '波次结束',
      nextRound: '下一波',
      win: '恭喜！你成功保卫了城市！',
      lose: '防线崩溃，城市陷落...',
      restart: '再玩一次',
      ammo: '弹药',
      instructions: '点击屏幕发射导弹拦截敌方火箭。预判敌人的飞行轨迹！',
      target: '目标分数: 1000'
    },
    en: {
      title: 'Tina Nova Defense',
      start: 'Start Game',
      score: 'Score',
      round: 'Round',
      roundEnd: 'Round Clear',
      nextRound: 'Next Wave',
      win: 'Victory! Cities are safe!',
      lose: 'Defense breached, cities lost...',
      restart: 'Play Again',
      ammo: 'Ammo',
      instructions: 'Click to fire interceptors. Lead your shots!',
      target: 'Target: 1000'
    }
  }[language];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col items-center justify-center p-4 overflow-hidden select-none">
      {/* Header */}
      <div className="w-full max-w-[800px] flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <Shield className="text-blue-500 w-8 h-8" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tighter uppercase italic">
            {t.title}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
            className="px-3 py-1 border border-white/20 rounded-full text-xs hover:bg-white/10 transition-colors"
          >
            {language === 'zh' ? 'English' : '中文'}
          </button>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase opacity-50 font-mono tracking-widest">{t.score}</span>
            <span className="text-xl font-mono text-amber-500 tabular-nums">{score.toString().padStart(5, '0')}</span>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative group">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseDown={handleCanvasClick}
          onTouchStart={handleCanvasClick}
          className="bg-black rounded-lg shadow-2xl shadow-blue-500/10 border border-white/5 cursor-crosshair w-full max-w-[800px] aspect-[4/3]"
        />

        {/* Overlays */}
        <AnimatePresence>
          {gameState === GameStatus.START && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center rounded-lg"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-md"
              >
                <Target className="w-16 h-16 text-amber-500 mx-auto mb-6 animate-pulse" />
                <h2 className="text-4xl font-black mb-4 tracking-tight italic uppercase">{t.title}</h2>
                <p className="text-gray-400 mb-8 leading-relaxed">{t.instructions}</p>
                <p className="text-amber-500/80 font-mono text-sm mb-8">{t.target}</p>
                <button 
                  onClick={initGame}
                  className="group relative px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-all hover:scale-105 active:scale-95"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    {t.start}
                  </span>
                  <div className="absolute inset-0 bg-blue-400 rounded-full blur-lg opacity-0 group-hover:opacity-30 transition-opacity" />
                </button>
              </motion.div>
            </motion.div>
          )}

          {gameState === GameStatus.ROUND_END && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center rounded-lg"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
              >
                <RefreshCw className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
                <h2 className="text-3xl font-bold mb-2 italic uppercase">{t.roundEnd}</h2>
                <div className="text-gray-400 mb-8">{t.round} {round}</div>
                <button 
                  onClick={nextRound}
                  className="px-12 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full transition-all active:scale-95"
                >
                  {t.nextRound}
                </button>
              </motion.div>
            </motion.div>
          )}

          {(gameState === GameStatus.WON || gameState === GameStatus.LOST) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center rounded-lg"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="max-w-md"
              >
                {gameState === GameStatus.WON ? (
                  <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-6" />
                ) : (
                  <AlertTriangle className="w-20 h-20 text-red-500 mx-auto mb-6" />
                )}
                <h2 className="text-3xl font-bold mb-2 italic uppercase">
                  {gameState === GameStatus.WON ? t.win : t.lose}
                </h2>
                <div className="mb-8 font-mono text-4xl text-amber-500">{score}</div>
                <button 
                  onClick={initGame}
                  className="flex items-center gap-2 mx-auto px-10 py-4 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-all active:scale-95"
                >
                  <RefreshCw className="w-5 h-5" />
                  {t.restart}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HUD Overlay */}
        {gameState === GameStatus.PLAYING && (
          <div className="absolute top-4 left-4 flex gap-4 pointer-events-none">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1 rounded-md flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-widest opacity-70">{t.target}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-[800px]">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase opacity-40 font-mono tracking-widest">System Status</span>
          <div className="h-[1px] bg-white/10 w-full mb-2" />
          <div className="flex justify-between text-xs font-mono">
            <span className="opacity-60">Cities Online</span>
            <span className="text-blue-400">{stateRef.current.cities.filter(c => !c.destroyed).length}/6</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase opacity-40 font-mono tracking-widest">Ordnance</span>
          <div className="h-[1px] bg-white/10 w-full mb-2" />
          <div className="flex justify-between text-xs font-mono">
            <span className="opacity-60">Batteries Active</span>
            <span className="text-emerald-400">{stateRef.current.turrets.filter(t => !t.destroyed).length}/3</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase opacity-40 font-mono tracking-widest">Intelligence</span>
          <div className="h-[1px] bg-white/10 w-full mb-2" />
          <div className="flex justify-between text-xs font-mono">
            <span className="opacity-60">Threat Level</span>
            <span className="text-red-400">Alpha-{round}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
