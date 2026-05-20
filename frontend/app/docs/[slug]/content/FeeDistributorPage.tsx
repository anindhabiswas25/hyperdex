import { H1, H2, P, Table, Mono } from '@/components/docs/DocsPrimitives';

export default function FeeDistributorPage() {
  return (
    <>
      <H1 tag="Programs">fee_distributor</H1>
      <P>The <Mono>fee_distributor</Mono> is a simple accounting contract that accumulates protocol fees and provides a controlled withdrawal path to the treasury.</P>

      <H2 id="design-rationale">Design rationale</H2>
      <P>Separating fee collection from vault custody means treasury withdrawal operations never touch maker inventory. An admin action on fee_distributor cannot accidentally affect taker or maker funds held in the vault.</P>

      <H2 id="functions">Functions</H2>
      <Table
        headers={['Function', 'Caller', 'Description']}
        rows={[
          ['collect_fee(token, amount)', 'quote_verifier only', 'Called once per settled trade to record fee'],
          ['withdraw(token, amount, to)', 'Admin', 'Transfers accumulated fees to treasury address'],
          ['get_balance(token)', 'Anyone', 'Returns accumulated fees for a token'],
          ['get_all_balances()', 'Anyone', 'Returns fee balances for all tokens'],
        ]}
      />
      <P><strong>Current fee rate:</strong> 10 bps (0.10%) of <Mono>amount_out</Mono></P>
      <P><strong>Address:</strong> <Mono>CBOQ5X23YTHT5NKB3EPW3Q3A77TRR4CQUYWEU4TA2XCNUKX57JTDYYJA</Mono></P>
    </>
  );
}
