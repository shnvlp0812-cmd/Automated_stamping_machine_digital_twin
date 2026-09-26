export let PANEL_CONFIG = {
    back_panel: { id: 'back_panel', name: 'Back Panel (Default)', cutLength: 1.3, totalContainers: 5, capacity: 25 },
    front_panel_ac: { id: 'front_panel_ac', name: 'Front Panel of AC', cutLength: 1.3, totalContainers: 5, capacity: 25 },
    side_panel_ac: { id: 'side_panel_ac', name: 'Side Panels of AC', cutLength: 0.8, totalContainers: 8, capacity: 25 }
};

export const updatePanelConfig = (models) => {
    if (!models || models.length === 0) return;
    const newConfig = {};
    models.forEach(m => {
        newConfig[m.model_id] = {
            id: m.model_id,
            name: m.name,
            cutLength: parseFloat(m.cut_length),
            totalContainers: parseInt(m.total_containers),
            capacity: parseInt(m.container_capacity)
        };
    });
    PANEL_CONFIG = newConfig;
};

export const getPanelConfig = (modelId) => {
    return PANEL_CONFIG[modelId] || Object.values(PANEL_CONFIG)[0];
};
