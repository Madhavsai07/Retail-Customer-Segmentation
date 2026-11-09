import unittest
import pandas as pd
from pipelines.feature_engineering import compute_rfm, engineer_features

class TestRFM(unittest.TestCase):
    def setUp(self):
        self.clean_data = pd.DataFrame({
            "InvoiceNo": ["1001", "1002", "1003", "1004"],
            "CustomerID": [101, 101, 102, 103],
            "InvoiceDate": pd.to_datetime([
                "2023-01-01 10:00:00",
                "2023-01-10 12:00:00",
                "2023-01-05 14:00:00",
                "2023-01-20 16:00:00"
            ]),
            "Quantity": [2, 3, 1, 5],
            "UnitPrice": [10.0, 20.0, 15.0, 8.0],
            "TotalPrice": [20.0, 60.0, 15.0, 40.0]
        })

    def test_rfm_customer_count(self):
        rfm = compute_rfm(self.clean_data)
        self.assertEqual(len(rfm), 3)

    def test_frequency_calculation(self):
        rfm = compute_rfm(self.clean_data)
        cust_101 = rfm[rfm["CustomerID"] == 101].iloc[0]
        self.assertEqual(cust_101["Frequency"], 2)

    def test_monetary_calculation(self):
        rfm = compute_rfm(self.clean_data)
        cust_101 = rfm[rfm["CustomerID"] == 101].iloc[0]
        self.assertEqual(cust_101["Monetary"], 80.0)

    def test_feature_scaling_bounds(self):
        rfm_raw, rfm_scaled = engineer_features(self.clean_data)
        for col in ["Recency", "Frequency", "Monetary"]:
            self.assertTrue((rfm_scaled[col] >= 0.0).all())
            self.assertTrue((rfm_scaled[col] <= 1.0).all())

if __name__ == "__main__":
    unittest.main()

