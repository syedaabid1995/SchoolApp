export default function ParentFeePaymentCompletePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#f6f7fb',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <section
        style={{
          maxWidth: 420,
          padding: 32,
          borderRadius: 20,
          background: '#ffffff',
          textAlign: 'center',
          boxShadow: '0 16px 40px rgba(24, 35, 68, 0.12)',
        }}
      >
        <h1 style={{ margin: 0, color: '#172554', fontSize: 24 }}>
          Payment received
        </h1>
        <p style={{ margin: '12px 0 0', color: '#526079', lineHeight: 1.5 }}>
          You can return to the Akademifyy parent app. Your fee balance will
          update after Razorpay confirms the payment.
        </p>
      </section>
    </main>
  );
}
