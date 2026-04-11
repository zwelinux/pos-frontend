"use client";

import React, { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export default function ProductReportDetail({ params }) {
  const { id } = React.use(params);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `${API}/products/${id}/report/`;
      const qs = [];
      if (from) qs.push(`from=${from}`);
      if (to) qs.push(`to=${to}`);
      if (qs.length) url += `?${qs.join("&")}`;

      const res = await authFetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(null);
      }
    } catch (err) {
      console.error("Error fetching report:", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchReport();
  }, [id]);

  const exportCSV = () => {
    if (!data) return;

    const rows = [
      ["Date", "Total Qty", "Total Sales"],
      ...data.daily.map((d) => [d.date, d.total_qty, d.total_sales]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((r) => r.join(",")).join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `${data.product?.name || "Product"}_report.csv`;
    link.click();
  };

  if (loading) return <p className="p-4">Loading...</p>;
  if (!data) return <p className="p-4 text-red-500">No data found</p>;

  const productName = data.product?.name || `Product #${data.product_id || id}`;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">
          {productName} — Product Report
        </h1>
        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div>
          <label className="block text-sm text-gray-700">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <button
          onClick={fetchReport}
          className="mt-5 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Filter
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 border rounded">
          <h3 className="font-medium">Total Quantity</h3>
          <p className="text-2xl">{data.totals?.total_qty || 0}</p>
        </div>
        <div className="p-3 border rounded">
          <h3 className="font-medium">Total Sales</h3>
          <p className="text-2xl">{data.totals?.total_sales || 0}</p>
        </div>
      </div>

      {/* Daily Summary Table */}
      <h2 className="font-medium mb-2">Daily Summary</h2>
      {data.daily?.length > 0 ? (
        <table className="w-full border mb-6 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left">Date</th>
              <th className="border px-2 py-1 text-right">Qty</th>
              <th className="border px-2 py-1 text-right">Sales</th>
            </tr>
          </thead>
          <tbody>
            {data.daily.map((d) => (
              <tr key={d.date}>
                <td className="border px-2 py-1">{d.date}</td>
                <td className="border px-2 py-1 text-right">{d.total_qty}</td>
                <td className="border px-2 py-1 text-right">{d.total_sales}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-gray-500">No daily data available</p>
      )}
    </div>
  );
}
