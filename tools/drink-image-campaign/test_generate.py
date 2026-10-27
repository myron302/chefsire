import hashlib, importlib.util, json, os, tempfile, types, unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('generate', Path(__file__).with_name('generate.py'))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

class BudgetSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.budget = dict(approved_by_user=True, approval_reference='mock user approval only', model='gpt-image-1', quality='medium', size='1536x1024', inventory_sha256='inventory', verified_pricing_source='mock source', pricing_verified_at='test', reserved_usd_per_request='0.25', approved_usd='1.00', allowed_image_ids=['IMG-034'])
        self.budget_path = self.directory/'budget.json'
        self.args = types.SimpleNamespace(budget=str(self.budget_path), start=34, model='gpt-image-1', quality='medium', size='1536x1024', output=str(self.directory/'output'))
        source = g.ROOT/'client/src/pages/drinks/index.tsx'
        self.task = dict(id='IMG-034', source_verification='verified_category_concept', source_evidence=dict(path=str(source.relative_to(g.ROOT)), sha256=hashlib.sha256(source.read_bytes()).hexdigest()), prompt='mock')
    def run_generate(self):
        self.budget_path.write_text(json.dumps(self.budget))
        g.execute(self.args, {'images':[self.task]}, {'inventory_sha256':'inventory','entries':[]})
    @patch.object(g.urllib.request, 'urlopen')
    def test_missing_approval_never_calls_provider(self, api):
        self.budget['approved_by_user']=False
        with self.assertRaisesRegex(ValueError,'No user-approved'):self.run_generate()
        api.assert_not_called()
    @patch.object(g.urllib.request, 'urlopen')
    def test_unapproved_id_never_calls_provider(self, api):
        self.budget['allowed_image_ids']=[]
        with self.assertRaisesRegex(ValueError,'outside approved scope'):self.run_generate()
        api.assert_not_called()
    @patch.dict(os.environ, {'OPENAI_API_KEY':'test-value-not-a-real-key'})
    @patch.object(g.urllib.request, 'urlopen')
    def test_budget_exhaustion_stops_before_request(self, api):
        self.budget['approved_usd']='0.20'
        with self.assertRaisesRegex(ValueError,'would be exceeded'):self.run_generate()
        api.assert_not_called()
    @patch.dict(os.environ, {'OPENAI_API_KEY':'test-value-not-a-real-key'})
    @patch.object(g.urllib.request, 'urlopen')
    def test_source_drift_stops_before_request(self, api):
        self.task['source_evidence']['sha256']='wrong'
        with self.assertRaisesRegex(ValueError,'source changed'):self.run_generate()
        api.assert_not_called()
    @patch.dict(os.environ, {'OPENAI_API_KEY':'test-value-not-a-real-key'})
    @patch.object(g.urllib.request, 'urlopen', side_effect=TimeoutError)
    def test_unknown_outcome_reserved_and_not_retried(self, api):
        with self.assertRaisesRegex(ValueError,'outcome unknown'):self.run_generate()
        ledger=json.loads((Path(self.args.output)/'ledger.json').read_text())
        self.assertEqual(ledger['reservations'][0]['reserved_usd'],'0.25')
        self.run_generate()
        self.assertEqual(api.call_count,1)
    def test_inventory_change_invalidates_budget(self):
        with self.assertRaisesRegex(ValueError,'inventory'):
            g.budget_checks(self.budget,'gpt-image-1','medium','1536x1024',{'inventory_sha256':'changed'},['IMG-034'])

if __name__=='__main__':unittest.main()
