export const Pedestal = {
    availableArtifacts: ['threebody'],
    activeArtifact: null,

    async loadArtifact(name, scene, anchor) {
        if (this.activeArtifact?.unload) this.activeArtifact.unload();
        this.activeArtifact = null;
        try {
            const mod = await import(`./artifacts/${name}.js`);
            if (mod.default?.init) {
                this.activeArtifact = mod.default;
                this.activeArtifact.init(scene, anchor);
            } else {
                console.error(`Artifact "${name}" has no valid default export.`);
            }
        } catch (e) {
            console.error(`Failed to load artifact "${name}"`, e);
        }
    },

    update(dt) {
        this.activeArtifact?.update?.(dt);
    },

    unload() {
        this.activeArtifact?.unload?.();
        this.activeArtifact = null;
    },
};
