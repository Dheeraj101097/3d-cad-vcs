import { useState, useCallback } from 'react';

// Hook — returns { confirmModal, ask }
// Usage:
//   const { confirmModal, ask } = useConfirm();
//   await ask({ title: '...', message: '...' }) && doDelete();
//   return <>{confirmModal}</>;
export function useConfirm() {
  const [state, setState] = useState(null); // { title, message, resolve }

  const ask = useCallback((opts) =>
    new Promise((resolve) => setState({ ...opts, resolve })),
  []);

  const close = (result) => {
    state?.resolve(result);
    setState(null);
  };

  const confirmModal = state ? (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]"
      onClick={() => close(false)}
    >
      <div
        className="bg-surface rounded-2xl p-6 w-[380px] max-w-[92vw] shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-red-500 text-base">!</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              {state.title ?? 'Are you sure?'}
            </h3>
            {state.message && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{state.message}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            className="px-4 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
            onClick={() => close(false)}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-all"
            onClick={() => close(true)}
          >
            {state.confirmLabel ?? 'Delete'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirmModal, ask };
}
