import { useNavigate, useSearchParams } from 'react-router-dom';

const styles = `
  .cs-wrap {
    min-height: 100%;
    padding: 1.5rem 1.25rem 7rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    text-align: center;
  }
  .cs-card {
    width: 100%;
    max-width: 360px;
    border-radius: 22px;
    background:
      radial-gradient(ellipse at 0% 0%, rgba(132, 169, 140, 0.35) 0%, transparent 55%),
      radial-gradient(ellipse at 100% 100%, rgba(53, 79, 82, 0.55) 0%, transparent 60%),
      linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    padding: 1.5rem 1.25rem 1.6rem;
    box-shadow: 0 12px 30px rgba(47, 62, 70, 0.18);
    position: relative;
    overflow: hidden;
  }
  .cs-eyebrow {
    font-size: 0.65rem;
    font-weight: 500;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #84a98c;
    margin: 0;
  }
  .cs-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.75rem;
    line-height: 1.15;
    font-weight: 400;
    color: #f0f5f2;
    margin: 0.35rem 0 0.6rem;
  }
  .cs-body {
    font-size: 0.85rem;
    color: rgba(202, 210, 197, 0.8);
    font-weight: 300;
    margin: 0;
  }
  .cs-back {
    border: none;
    background: linear-gradient(135deg, #354f52 0%, #52796f 100%);
    color: #cad2c5;
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    padding: 0.75rem 1.5rem;
    border-radius: 999px;
    box-shadow: 0 4px 14px rgba(53, 79, 82, 0.25);
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
  }
  .cs-back:active { transform: scale(0.97); }
`;

export default function ComingSoon() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const feature = params.get('feature') || 'This feature';

  return (
    <>
      <style>{styles}</style>
      <div className="cs-wrap">
        <div className="cs-card">
          <p className="cs-eyebrow">In the pipeline</p>
          <h2 className="cs-title">{feature}</h2>
          <p className="cs-body">
            We're bringing this screen to mobile next. It's already live on the web app.
          </p>
        </div>
        <button className="cs-back" onClick={() => navigate(-1)}>Back to home</button>
      </div>
    </>
  );
}
