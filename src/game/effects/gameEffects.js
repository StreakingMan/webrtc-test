import { Body } from '../physics/physicsEngine';
import { COLLECT_EFFECT_CONFIG, NEGATIVE_EFFECT_CONFIG } from '../config/gameConfig';

// 创建收集特效
export function createCollectEffect(x, y, color, gameState) {
    // 创建粒子爆炸效果
    for (let i = 0; i < COLLECT_EFFECT_CONFIG.particleCount; i++) {
        const angle = (Math.PI * 2 / COLLECT_EFFECT_CONFIG.particleCount) * i;
        const speed = COLLECT_EFFECT_CONFIG.particleSpeed * (0.5 + Math.random() * 0.5);
        
        gameState.effects.collectParticles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 3 + Math.random() * 2,
            color: color,
            life: COLLECT_EFFECT_CONFIG.particleLifeSpan,
            maxLife: COLLECT_EFFECT_CONFIG.particleLifeSpan
        });
    }

    // 创建闪光效果
    gameState.effects.flashes.push({
        x: x,
        y: y,
        radius: 0,
        maxRadius: 40,
        life: COLLECT_EFFECT_CONFIG.flashDuration,
        maxLife: COLLECT_EFFECT_CONFIG.flashDuration,
        color: color
    });
}

// 创建负面特效
export function createNegativeEffect(x, y, gameState) {
    // 创建震动效果
    if (gameState.local.body) {
        const originalX = gameState.local.body.position.x;
        const originalY = gameState.local.body.position.y;
        let shakeCount = 0;
        const shakeInterval = setInterval(() => {
            if (shakeCount >= NEGATIVE_EFFECT_CONFIG.shakeDuration) {
                clearInterval(shakeInterval);
                Body.setPosition(gameState.local.body, { x: originalX, y: originalY });
                return;
            }

            const offsetX = (Math.random() - 0.5) * NEGATIVE_EFFECT_CONFIG.shakeIntensity;
            const offsetY = (Math.random() - 0.5) * NEGATIVE_EFFECT_CONFIG.shakeIntensity;
            Body.setPosition(gameState.local.body, {
                x: originalX + offsetX,
                y: originalY + offsetY
            });

            shakeCount++;
        }, 50);
    }

    // 创建红色粒子效果
    for (let i = 0; i < NEGATIVE_EFFECT_CONFIG.particleCount; i++) {
        const angle = (Math.PI * 2 / NEGATIVE_EFFECT_CONFIG.particleCount) * i;
        const speed = NEGATIVE_EFFECT_CONFIG.particleSpeed * (0.8 + Math.random() * 0.4);
        
        gameState.effects.collectParticles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 3 + Math.random() * 2,
            color: NEGATIVE_EFFECT_CONFIG.flashColor,
            life: NEGATIVE_EFFECT_CONFIG.particleLifeSpan,
            maxLife: NEGATIVE_EFFECT_CONFIG.particleLifeSpan
        });
    }
}

// 更新特效
export function updateEffects(gameState) {
    // 更新本地玩家轨迹
    if (gameState.local.body) {
        // 添加新的轨迹点，降低速度阈值使尾迹更连续
        if (Math.abs(gameState.local.body.velocity.x) > 0.3 || Math.abs(gameState.local.body.velocity.y) > 0.3) {
            gameState.local.effects.trail.push({
                x: gameState.local.body.position.x,
                y: gameState.local.body.position.y,
                life: 35,        // 增加生命周期
                maxLife: 35,     // 增加最大生命周期
                color: gameState.local.color,
                size: 4          // 保持大小不变
            });
        }
    }

    // 更新远程玩家轨迹
    if (gameState.remote.body) {
        if (Math.abs(gameState.remote.body.velocity.x) > 0.3 || Math.abs(gameState.remote.body.velocity.y) > 0.3) {
            gameState.remote.effects.trail.push({
                x: gameState.remote.body.position.x,
                y: gameState.remote.body.position.y,
                life: 35,        // 增加生命周期
                maxLife: 35,     // 增加最大生命周期
                color: gameState.remote.color,
                size: 4          // 保持大小不变
            });
        }
    }

    // 更新轨迹生命周期
    [gameState.local.effects.trail, gameState.remote.effects.trail].forEach(trail => {
        for (let i = trail.length - 1; i >= 0; i--) {
            trail[i].life--;
            if (trail[i].life <= 0) {
                trail.splice(i, 1);
            }
        }
    });

    // 更新跳跃粒子
    [gameState.local.effects.jumpParticles, gameState.remote.effects.jumpParticles].forEach(particles => {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2; // 粒子重力
            p.life--;
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    });

    // 更新收集特效粒子
    for (let i = gameState.effects.collectParticles.length - 1; i >= 0; i--) {
        const particle = gameState.effects.collectParticles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life--;
        
        // 添加重力效果
        particle.vy += 0.1;
        
        if (particle.life <= 0) {
            gameState.effects.collectParticles.splice(i, 1);
        }
    }

    // 更新闪光效果
    for (let i = gameState.effects.flashes.length - 1; i >= 0; i--) {
        const flash = gameState.effects.flashes[i];
        flash.life--;
        flash.radius = (flash.maxRadius * (flash.maxLife - flash.life)) / flash.maxLife;
        
        if (flash.life <= 0) {
            gameState.effects.flashes.splice(i, 1);
        }
    }
}

// 渲染特效
export function renderEffects(ctx, gameState) {
    // 渲染轨迹
    [gameState.local.effects.trail, gameState.remote.effects.trail].forEach(trail => {
        trail.forEach(point => {
            ctx.beginPath();
            const alpha = Math.floor((point.life / point.maxLife) * 255);
            const size = point.size * (point.life / point.maxLife);
            ctx.fillStyle = `${point.color}${alpha.toString(16).padStart(2, '0')}`;
            ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
            ctx.fill();
        });
    });

    // 渲染跳跃粒子
    [gameState.local.effects.jumpParticles, gameState.remote.effects.jumpParticles].forEach((particles, idx) => {
        const baseColor = idx === 0 ? gameState.local.color : gameState.remote.color;
        particles.forEach(p => {
            ctx.beginPath();
            // 二段跳的粒子使用不同的颜色
            const color = p.isSecondJump ? '#FFE66D' : baseColor;
            ctx.fillStyle = `${color}${Math.floor((p.life / p.maxLife) * 255).toString(16).padStart(2, '0')}`;
            ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
            ctx.fill();
        });
    });

    // 渲染收集特效粒子
    gameState.effects.collectParticles.forEach(particle => {
        const alpha = particle.life / particle.maxLife;
        ctx.beginPath();
        ctx.fillStyle = `${particle.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    });

    // 渲染闪光效果
    gameState.effects.flashes.forEach(flash => {
        const alpha = flash.life / flash.maxLife;
        if (flash.isFade) {
            // 透明度渐变效果
            ctx.beginPath();
            // 计算当前透明度，实现4次变化
            const pulseProgress = (flash.maxLife - flash.life) / flash.maxLife;
            const pulseAlpha = Math.sin(pulseProgress * Math.PI * NEGATIVE_EFFECT_CONFIG.pulseCount) * 0.5 + 0.5;
            const currentAlpha = flash.initialAlpha * pulseAlpha;
            ctx.fillStyle = `${flash.color}${Math.floor(currentAlpha * 255).toString(16).padStart(2, '0')}`;
            ctx.arc(flash.x, flash.y, flash.radius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 原有的闪光效果
            const gradient = ctx.createRadialGradient(
                flash.x, flash.y, 0,
                flash.x, flash.y, flash.radius
            );
            gradient.addColorStop(0, `${flash.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
            gradient.addColorStop(1, `${flash.color}00`);
            
            ctx.beginPath();
            ctx.fillStyle = gradient;
            ctx.arc(flash.x, flash.y, flash.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

// 创建跳跃特效
export function createJumpEffect(gameState, jumpCount) {
    const isSecondJump = jumpCount === 2;
    const particleCount = isSecondJump ? 20 : 12;  // 增加粒子数量
    const baseSpeed = isSecondJump ? 1.5 : 1;      // 降低粒子速度
    
    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 / particleCount) * i;
        const speed = baseSpeed * (0.8 + Math.random() * 0.4);
        
        gameState.local.effects.jumpParticles.push({
            x: gameState.local.body.position.x,
            y: gameState.local.body.position.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed + 0.8,  // 降低向上的初始速度
            size: isSecondJump ? 5 : 4,         // 增加粒子大小
            life: isSecondJump ? 35 : 25,       // 增加粒子持续时间
            maxLife: isSecondJump ? 35 : 25,
            isSecondJump: isSecondJump
        });
    }

    // 如果是二段跳，添加额外的闪光效果
    if (isSecondJump) {
        gameState.effects.flashes.push({
            x: gameState.local.body.position.x,
            y: gameState.local.body.position.y,
            radius: 0,
            maxRadius: 40,        // 增加闪光范围
            life: 20,             // 增加闪光持续时间
            maxLife: 20,
            color: '#FFE66D'      // 明亮的黄色闪光
        });
    }
} 