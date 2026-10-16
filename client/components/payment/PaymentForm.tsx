import { useState } from 'react';
import { createPaymentToken } from '../../lib/api/payment'; // fixed path
import styles from '../../styles/payment.module.css';

declare global {
  interface Window {
    snap?: {
      pay: (token: string, callbacks: any) => void;
    };
  }
}

export default function PaymentForm({ userId }: { userId: string }) {
  const [isBooster, setIsBooster] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapToken, setSnapToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const amountIDR = isBooster ? 1800000 : 2000000;
      const { token } = await createPaymentToken({
        userId,
        amountIDR,
        isBooster,
        orderType: 'registration',
      });
      setSnapToken(token);

      // invoke Midtrans Snap if library loaded on page
      if (window.snap) {
        window.snap.pay(token, {
          onSuccess: (result: any) => {
            window.location.reload();
          },
          onPending: (result: any) => {
            console.log('Payment pending:', result);
          },
          onError: (err: any) => {
            setError('Payment failed: ' + err.message);
          },
        });
      } else {
        setError('Midtrans Snap library not loaded.');
      }
    } catch (err: any) {
      setError('Failed to create payment token: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <form onSubmit={handleSubmit} className={styles.paymentForm}>
        <h2>Registration Payment</h2>
        <p>
          One‑time payment to activate your AI Trading account and get access to the AI engine.
        </p>

        <div className={styles.priceOptions}>
          <label>
            <input
              type="radio"
              checked={!isBooster}
              onChange={() => setIsBooster(false)}
            />
            <div className={styles.priceOption}>
              <span className={styles.price}>Rp 2.000.000</span>
              <span className={styles.description}>Standard Registration</span>
            </div>
          </label>

          <label>
            <input
              type="radio"
              checked={isBooster}
              onChange={() => setIsBooster(true)}
            />
            <div className={styles.priceOption}>
              <span className={styles.price}>Rp 1.800.000</span>
              <span className={styles.description}>Booster (10% discount)</span>
            </div>
          </label>
        </div>

        <button type="submit" disabled={loading} className={styles.payButton}>
          {loading ? 'Processing...' : 'Pay Now'}
        </button>

        {error && <div className={styles.error}>{error}</div>}
      </form>
    </div>
  );
}
