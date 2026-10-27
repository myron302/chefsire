import base64, hashlib, importlib.util, io, json, os, tempfile, types, unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('generate', Path(__file__).with_name('generate.py'))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

class BudgetSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.plan_path = self.directory/'plan.json'
        source = g.ROOT/'client/src/pages/drinks/index.tsx'
        self.task = dict(id='IMG-034', source_verification='verified_category_concept', source_evidence=dict(path=str(source.relative_to(g.ROOT)), sha256=hashlib.sha256(source.read_bytes()).hexdigest()), prompt='mock')
        self.plan = {'images':[self.task]}
        self.plan_path.write_text(json.dumps(self.plan))
        self.budget = dict(approved_by_user=True, approval_reference='mock approval only', model='gpt-image-2', quality='high', size='1536x1024', output_format='png', allow_experimental_size=False, inventory_sha256='inventory', plan_sha256=hashlib.sha256(self.plan_path.read_bytes()).hexdigest(), verified_pricing_source='mock source', pricing_verified_at='test', reserved_usd_per_request='0.25', approved_usd='0.75', allowed_image_ids=['IMG-034'], max_requests=3, max_prompt_utf8_bytes=4000, account_pricing_confirmed=True, account_pricing_confirmation_reference='mock account quote')
        self.budget_path = self.directory/'budget.json'
        self.args = types.SimpleNamespace(budget=str(self.budget_path), plan=str(self.plan_path), start=34, model='gpt-image-2', quality='high', size='1536x1024', output_format='png', allow_experimental_size=False, output=str(self.directory/'output'), state_dir=str(self.directory/'state'))
        network = patch.object(g, 'network_allowed', return_value=True);network.start();self.addCleanup(network.stop)
        env=patch.dict(os.environ, {'OPENAI_API_KEY':'fake-unit-test-key'});env.start();self.addCleanup(env.stop)
    def run_generate(self):
        self.budget_path.write_text(json.dumps(self.budget))
        g.execute(self.args, self.plan, {'inventory_sha256':'inventory','entries':[]})
    def ledger(self):
        return json.loads((Path(self.args.state_dir)/'ledger.json').read_text())
    @patch.object(g, 'api_urlopen')
    def test_missing_approval_never_calls_provider(self, api):
        self.budget['approved_by_user']=False
        with self.assertRaisesRegex(ValueError,'No user-approved'):self.run_generate()
        api.assert_not_called()
    @patch.object(g, 'api_urlopen')
    def test_unapproved_id_never_calls_provider(self, api):
        self.budget['allowed_image_ids']=[]
        with self.assertRaisesRegex(ValueError,'outside approved scope'):self.run_generate()
        api.assert_not_called()
    @patch.object(g, 'api_urlopen')
    def test_budget_exhaustion_stops_before_request(self, api):
        self.budget['approved_usd']='0.20'
        with self.assertRaisesRegex(ValueError,'would be exceeded'):self.run_generate()
        api.assert_not_called()
    @patch.object(g, 'api_urlopen')
    def test_source_drift_stops_before_request(self, api):
        self.task['source_evidence']['sha256']='wrong'
        with self.assertRaisesRegex(ValueError,'source changed'):self.run_generate()
        api.assert_not_called()
    @patch.object(g, 'api_urlopen', side_effect=TimeoutError)
    def test_unknown_outcome_reserved_and_not_retried_in_new_output_directory(self, api):
        with self.assertRaisesRegex(ValueError,'outcome unknown'):self.run_generate()
        self.assertEqual(self.ledger()['reservations'][0]['reserved_usd'],'0.25')
        self.args.output=str(self.directory/'different-output')
        self.run_generate()
        self.assertEqual(api.call_count,1)
    def test_inventory_change_invalidates_budget(self):
        with self.assertRaisesRegex(ValueError,'inventory'):
            g.budget_checks(self.budget,'gpt-image-2','high','1536x1024',{'inventory_sha256':'changed'},['IMG-034'])
    @patch.object(g, 'api_urlopen')
    def test_plan_change_invalidates_budget(self, api):
        self.plan_path.write_text('changed')
        with self.assertRaisesRegex(ValueError,'plan changed'):self.run_generate()
        api.assert_not_called()
    @patch.object(g, 'api_urlopen')
    def test_missing_account_rate_confirmation_stops(self, api):
        self.budget['account_pricing_confirmed']=False
        with self.assertRaisesRegex(ValueError,'standard rate'):self.run_generate()
        api.assert_not_called()
    @patch.object(g, 'api_urlopen')
    def test_no_network_permission_stops(self, api):
        with patch.object(g, 'network_allowed', return_value=False):
            with self.assertRaisesRegex(ValueError,'not authorized'):self.run_generate()
        api.assert_not_called()
    @patch.object(g, 'api_urlopen')
    def test_no_key_stops(self, api):
        with patch.dict(os.environ, {'OPENAI_API_KEY':''}):
            with self.assertRaisesRegex(ValueError,'not configured'):self.run_generate()
        api.assert_not_called()
    @patch.object(g, 'api_urlopen')
    def test_unsafe_approval_number_stops(self, api):
        for value in ['NaN','Infinity','-1','0']:
            self.budget['approved_usd']=value
            with self.assertRaises(ValueError):self.run_generate()
        api.assert_not_called()
    @patch.object(g, 'api_urlopen')
    def test_existing_untracked_output_not_overwritten(self, api):
        path=Path(self.args.output);path.mkdir();(path/'IMG-034-original.png').write_bytes(b'preserved')
        with self.assertRaisesRegex(ValueError,'already exists'):self.run_generate()
        self.assertEqual((path/'IMG-034-original.png').read_bytes(),b'preserved');api.assert_not_called()
    @patch.object(g, 'api_urlopen')
    def test_duplicate_ids_rejected(self, api):
        self.plan['images'].append(self.task)
        with self.assertRaisesRegex(ValueError,'Duplicate image IDs'):self.run_generate()
        api.assert_not_called()
    @patch.object(g, 'api_urlopen', side_effect=TimeoutError)
    def test_request_count_limit_preserves_reservation(self, api):
        self.budget['max_requests']=1
        with self.assertRaises(ValueError):self.run_generate()
        second={**self.task,'id':'IMG-035'};self.plan['images']=[second];self.plan_path.write_text(json.dumps(self.plan));self.budget['plan_sha256']=hashlib.sha256(self.plan_path.read_bytes()).hexdigest();self.budget['allowed_image_ids'].append('IMG-035')
        with self.assertRaisesRegex(ValueError,'request-count limit'):self.run_generate()
        self.assertEqual(api.call_count,1)
    @patch.object(g, 'duplicate_matches', return_value=({'sha256':'mock'}, []))
    @patch.object(g, 'api_urlopen')
    def test_current_api_request_and_original_preservation(self, api, duplicates):
        raw=io.BytesIO();g.Image.new('RGB',(1536,1024),'gray').save(raw,'PNG');data=raw.getvalue()
        api.return_value=io.BytesIO(json.dumps({'created':1,'data':[{'b64_json':base64.b64encode(data).decode()}],'usage':{'output_tokens':5500}}).encode())
        self.run_generate();body=json.loads(api.call_args.args[0].data)
        self.assertEqual(body,dict(model='gpt-image-2',prompt='mock',n=1,size='1536x1024',quality='high',output_format='png',background='opaque',stream=False))
        self.assertEqual((Path(self.args.output)/'IMG-034-original.png').read_bytes(),data)
        self.assertEqual(self.ledger()['reservations'][0]['integration_status'],'not_integrated')

class ModelContractTests(unittest.TestCase):
    def test_redirects_cannot_forward_credentials(self):
        with self.assertRaisesRegex(ValueError,'redirects are refused'):
            g.NoRedirect().redirect_request(None,None,302,'redirect',{},'https://example.com')

    def test_standard_custom_and_portrait_sizes(self):
        for size in ['1536x1024','1024x1536','1024x1024','1536x864','640x1024']:
            self.assertEqual(g.validate_request('gpt-image-2','high',size),tuple(map(int,size.split('x'))))
    def test_invalid_or_unapproved_contracts(self):
        for model,quality,size in [('gpt-image-1','high','1536x1024'),('gpt-image-2','xhigh','1536x1024'),('gpt-image-2','auto','1536x1024'),('gpt-image-2','high','auto'),('gpt-image-2','high','1535x1024'),('gpt-image-2','high','512x512'),('gpt-image-2','high','4000x2160'),('gpt-image-2','high','3072x640'),('gpt-image-2','high','3840x2160')]:
            with self.subTest(model=model,quality=quality,size=size),self.assertRaises(ValueError):g.validate_request(model,quality,size)
    def test_experimental_dimensions_require_explicit_policy(self):
        self.assertEqual(g.validate_request('gpt-image-2','high','3840x2160',allow_experimental=True),(3840,2160))
    def test_png_webp_jpeg_supported(self):
        for fmt in ['png','webp','jpeg']:g.validate_request('gpt-image-2','high','1536x1024',fmt)
    def test_pixel_duplicate_detected_across_encodings(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'other.png';im=g.Image.new('RGB',(16,16),'red');im.save(path)
            raw=io.BytesIO();im.save(raw,'PNG',compress_level=0)
            _,matches=g.duplicate_matches(raw.getvalue(),[path]);self.assertTrue(matches[0]['exact'])
    @patch.object(g, 'api_urlopen')
    def test_offline_preflight_never_contacts_provider(self, api):
        result=g.preflight('gpt-image-2');self.assertEqual(result['generation_calls'],0);api.assert_not_called()

if __name__=='__main__':unittest.main()
