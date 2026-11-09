import unittest
import pandas as pd
from pipelines.data_cleaning import clean_data

class TestDataCleaning(unittest.TestCase):
    def setUp(self):
        self.sample_data = pd.DataFrame({
            "InvoiceNo": ["536365", "C536366", "536367", "536368", "536369"],
            "StockCode": ["85123A", "71053", "84406B", "84029G", "71053"],
            "Description": ["WHITE HANGING HEART", "WHITE METAL LANTERN", "CREAM CUPID", "KNITTED UNION FLAG", "LANTERN"],
            "Quantity": [6, -1, 0, 50, 10],
            "InvoiceDate": [
                "2023-01-10 08:26:00",
                "2023-01-10 08:28:00",
                "2023-01-11 09:00:00",
                "2023-01-12 10:15:00",
                "2023-01-12 11:30:00"
            ],
            "UnitPrice": [2.55, 3.39, 4.25, -1.0, 5.00],
            "CustomerID": [17850.0, 17850.0, 13047.0, 12583.0, None],
            "Country": ["United Kingdom", "United Kingdom", "United Kingdom", "France", "United Kingdom"]
        })

    def test_null_customer_id_removed(self):
        df_clean, summary = clean_data(self.sample_data)
        self.assertFalse(df_clean["CustomerID"].isna().any())

    def test_cancellations_filtered(self):
        df_clean, summary = clean_data(self.sample_data)
        self.assertFalse(df_clean["InvoiceNo"].astype(str).str.startswith("C").any())

    def test_positive_quantity_and_price(self):
        df_clean, summary = clean_data(self.sample_data)
        self.assertTrue((df_clean["Quantity"] > 0).all())
        self.assertTrue((df_clean["UnitPrice"] > 0).all())

    def test_total_price_identity(self):
        df_clean, summary = clean_data(self.sample_data)
        expected = (df_clean["Quantity"] * df_clean["UnitPrice"]).round(2)
        pd.testing.assert_series_equal(df_clean["TotalPrice"], expected, check_names=False)

if __name__ == "__main__":
    unittest.main()

