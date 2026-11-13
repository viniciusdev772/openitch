"use client";

export default function EstanteErro({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap acc acc--single">
      <div className="acc-main">
        <div className="bo-sheet">
          <p className="bo-alert" role="alert">
            Não conseguimos abrir sua estante agora. Nada do que você guardou se perdeu.
          </p>
          <div className="bo-row bo-row--end">
            <button type="button" className="btn" onClick={reset}>
              Tentar de novo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
