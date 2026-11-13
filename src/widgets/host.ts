// <garden-widget name="…" data-props="{…}"> — mounts an interactive Preact
// component wherever a ```widget block appears in a note. Each widget is its
// own lazily-loaded chunk, so pages without widgets ship none of this code.
//
// To add a widget: create src/widgets/<Name>.tsx with a default export and
// register it below.

import { h, render, type ComponentType } from "preact";

const registry: Record<string, () => Promise<{ default: ComponentType<any> }>> = {
  dcf: () => import("./ReverseDcf"),
};

class GardenWidget extends HTMLElement {
  async connectedCallback() {
    const name = this.getAttribute("name") ?? "";
    const loader = registry[name];
    let props: Record<string, unknown> = {};
    try {
      props = JSON.parse(this.dataset.props ?? "{}");
    } catch {}
    if (!loader) return this.fail(`Unknown widget "${name}". Registered: ${Object.keys(registry).join(", ")}.`);
    if (props.__error) return this.fail(`Couldn't read this widget's settings: ${props.__error}`);
    try {
      const { default: Component } = await loader();
      this.replaceChildren();
      render(h(Component, props), this);
    } catch (err) {
      this.fail(`Widget "${name}" failed to load.`);
      console.error(err);
    }
  }

  disconnectedCallback() {
    render(null, this);
  }

  private fail(message: string) {
    this.innerHTML = `<div class="widget-error"></div>`;
    this.firstElementChild!.textContent = message;
  }
}

if (!customElements.get("garden-widget")) customElements.define("garden-widget", GardenWidget);
