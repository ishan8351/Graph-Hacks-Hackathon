import "@testing-library/jest-dom";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock;
window.ResizeObserver = ResizeObserverMock;
window.HTMLElement.prototype.scrollIntoView = function () {};
