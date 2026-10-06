import { normalizeDelimiterData, type DelimiterData } from '../../lib/lessonDelimiter';
import './delimiter.css';

export class CustomDelimiterTool {
  static get toolbox() {
    return { title: 'Роздільник', icon: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M2 8c4-5 9 5 16 0M2 12c4-5 9 5 16 0" stroke="currentColor" fill="none"/></svg>' };
  }
  static get isReadOnlySupported() { return true; }
  render(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'anglica-delimiter-editor';
    wrapper.setAttribute('role', 'separator');
    wrapper.setAttribute('aria-label', 'Роздільник');
    const flow = document.createElement('div');
    flow.className = 'anglica-delimiter-flow';
    flow.setAttribute('aria-hidden', 'true');
    flow.innerHTML = '<svg viewBox="0 0 300 40" preserveAspectRatio="none"><path d="M0 20C60 2 95 38 155 20s100-18 145 0C250 13 210 43 155 25S60 9 0 20Z" fill="currentColor" opacity=".18"/><path d="M0 20C45 39 105 2 160 22s95 6 140-2C255 39 210 9 160 27S45 43 0 20Z" fill="currentColor" opacity=".13"/></svg>';
    wrapper.append(flow);
    return wrapper;
  }
  save(): DelimiterData { return normalizeDelimiterData(); }
}
