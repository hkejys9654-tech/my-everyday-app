(() => {
    'use strict';
    const bridge = window.webkit?.messageHandlers?.health;
    if (!bridge) return;
    let selected = [];
    let available = [];
    const dateInput = document.getElementById('dateInput');
    // The original web form uses UTC; health workout dates use the phone's local day.
    document.addEventListener('DOMContentLoaded', () => {
        const now = new Date();
        dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }, {once: true});
    const panel = document.createElement('section');
    panel.className = 'card';
    panel.innerHTML = '<h3>Apple 건강 운동</h3><p>최근 30일의 운동 중 선택한 날짜에 시작한 운동을 가져옵니다. 건강 앱에 저장된 다른 앱의 운동도 포함될 수 있어요.</p><button type="button" class="btn-load-last">운동 가져오기</button><p role="status" aria-live="polite"></p><div></div>';
    document.getElementById('header-exercise').closest('.habit-block').after(panel);
    const button = panel.querySelector('button');
    const status = panel.querySelector('[role="status"]');
    const list = panel.lastElementChild;
    function valid(w) {
        return w && typeof w.id === 'string' && /^[0-9a-f-]{36}$/i.test(w.id)
            && typeof w.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.date)
            && typeof w.name === 'string' && Number.isFinite(w.durationMinutes) && w.durationMinutes >= 0;
    }
    function describe(w) {
        const parts = [w.name, `${Math.round(w.durationMinutes)}분`];
        for (const [key, unit] of [['distanceKm', 'km'], ['calories', 'kcal'], ['averageHeartRate', '평균 bpm'], ['maxHeartRate', '최대 bpm']]) {
            if (Number.isFinite(w[key]) && w[key] >= 0) parts.push(`${Math.round(w[key] * 10) / 10} ${unit}`);
        }
        return parts.join(' · ');
    }
    function escape(text) {
        return text.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
    }
    function alreadySaved(id) {
        return allRecordsCache.some(r => (r.healthWorkouts || []).some(w => w.id === id));
    }
    function render() {
        list.replaceChildren();
        for (const workout of available.filter(w => w.date === dateInput.value)) {
            const row = document.createElement('label');
            row.style.cssText = 'display:flex;gap:10px;align-items:center;padding:12px 0;border-top:1px solid #d7e1ec';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = selected.some(w => w.id === workout.id);
            checkbox.disabled = alreadySaved(workout.id);
            checkbox.addEventListener('change', () => {
                selected = selected.filter(w => w.id !== workout.id);
                if (checkbox.checked) selected.push(workout);
            });
            row.append(checkbox, document.createTextNode(describe(workout) + (checkbox.disabled ? ' (이미 저장됨)' : '')));
            list.append(row);
        }
        status.textContent = list.children.length
            ? '저장할 운동을 선택한 뒤 아래의 기록 저장하기를 눌러주세요.'
            : '선택한 날짜에 표시할 운동이 없습니다. 날짜와 건강 앱의 접근 허용 설정을 확인해주세요.';
    }
    button.addEventListener('click', async () => {
        button.disabled = true;
        status.textContent = '건강 앱의 운동을 확인하고 있어요…';
        try {
            const result = await bridge.postMessage({action: 'readWorkouts'});
            if (!Array.isArray(result)) throw new Error('Invalid response');
            available = [...new Map(result.filter(valid).map(w => [w.id, w])).values()];
            selected = selected.filter(w => available.some(a => a.id === w.id));
            render();
        } catch (_) {
            status.textContent = '운동을 가져오지 못했습니다. 건강 데이터 접근 설정을 확인하고 다시 시도해주세요.';
        } finally { button.disabled = false; }
    });
    dateInput.addEventListener('change', () => { selected = []; render(); });
    window.checkupHealth = {
        forDate: date => selected.filter(w => w.date === date && !alreadySaved(w.id)).map(w => ({...w})),
        summary: workouts => workouts.filter(valid).map(w => escape(describe(w))).join(' / '),
        clear: () => { selected = []; available = []; list.replaceChildren(); status.textContent = ''; }
    };
})();
