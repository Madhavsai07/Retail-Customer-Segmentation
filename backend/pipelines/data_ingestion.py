""" data_ingestion.py """

import logging
import pandas as pd
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = [
    "InvoiceNo", "StockCode", "Description",
    "Quantity", "InvoiceDate", "UnitPrice",
    "CustomerID", "Country",
]

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "online_retail.xlsx"


def load_data(path: Path = DATA_PATH) -> pd.DataFrame:
    """Load the Online Retail dataset from an Excel file."""
    logger.info(f"Loading dataset from: {path}")
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found at: {path}")

    df = pd.read_excel(path, engine="openpyxl")
    logger.info(f"Raw dataset loaded — rows: {len(df):,}, columns: {list(df.columns)}")

    missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    logger.info("Schema validation passed.")
    return df


if __name__ == "__main__":
    df = load_data()
    print(df.head())
