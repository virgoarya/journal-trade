import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import PaymentForm from '../../components/payment/PaymentForm';
import PaymentStatus from '../../components/payment/PaymentStatus';
import PaymentSuccess from '../../components/payment/PaymentSuccess';
import PaymentError from '../../components/payment/PaymentError';
import { getPaymentStatus } from '../../lib/api/payment';
import styles from '../../styles/payment.module.css';

interface PaymentPageProps {
  userId: string;
}

export default function PaymentPage({ userId }: PaymentPageProps) {
  const router = useRouter();
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaymentStatus = async () => {
      try {
        const status = await getPaymentStatus(userId);
        setPaymentStatus(status);
      } catch (err) {
        setError('Failed to fetch payment status');
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentStatus();
  }, [userId]);

  if (loading) {
    return <div className={styles.loading}>Loading payment status...</div>;
  }

  if (error) {
    return <PaymentError message={error} />;
  }

  if (paymentStatus?.isRegistered) {
    return <PaymentSuccess userId={userId} />;
  }

  return (
    <div className={styles.paymentContainer}>
      <h1 className={styles.title}>AI Trading Payment</h1>
      <PaymentForm userId={userId} />
      <PaymentStatus status={paymentStatus} />
    </div>
  );
}
