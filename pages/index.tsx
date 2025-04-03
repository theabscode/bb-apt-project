// pages/index.tsx
import fs from "fs";
import path from "path";

// 서버 사이드에서 파일 읽기: getStaticProps 함수 추가
export async function getStaticProps() {
  const filePath = path.join(process.cwd(), "paste.txt");
  const data = fs.readFileSync(filePath, "utf8");
  const lines = data.split("\n");
  return { props: { lines } };
}

export default function SimpleChart({ lines }: { lines: string[] }) {
  // 여기서 'lines'를 사용하여 그래프나 데이터를 처리합니다.
  return (
    <div>
      <h1>파일 데이터</h1>
      <pre>{lines.join("\n")}</pre>
      {/* 기존 그래프 코드 계속 */}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// 간단한 부동산 가격 분석 컴포넌트
const SimpleChart = () => {
  // 기본 데이터 상태 관리
  const [data, setData] = useState({});
  const [chartData, setChartData] = useState([]);
  const [selectedType, setSelectedType] = useState("80B㎡");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 분기별 데이터 준비 함수
  const prepareQuarterlyData = (typeData) => {
    if (!typeData) return [];

    const buyByQuarter = {};
    const rentByQuarter = {};

    // 매매 데이터 처리
    if (typeData.매매 && typeData.매매.length > 0) {
      typeData.매매.forEach((item) => {
        if (!item.date) return;

        const dateParts = item.date.split(".");
        if (dateParts.length >= 2) {
          const year = parseInt(dateParts[0]);
          const month = parseInt(dateParts[1]);
          const quarter = Math.ceil(month / 3);
          const quarterKey = `${year}Q${quarter}`;

          if (!buyByQuarter[quarterKey]) {
            buyByQuarter[quarterKey] = [];
          }

          buyByQuarter[quarterKey].push(item.price);
        }
      });
    }

    // 전세 데이터 처리
    if (typeData.전세 && typeData.전세.length > 0) {
      typeData.전세.forEach((item) => {
        if (!item.date) return;

        const dateParts = item.date.split(".");
        if (dateParts.length >= 2) {
          const year = parseInt(dateParts[0]);
          const month = parseInt(dateParts[1]);
          const quarter = Math.ceil(month / 3);
          const quarterKey = `${year}Q${quarter}`;

          if (!rentByQuarter[quarterKey]) {
            rentByQuarter[quarterKey] = [];
          }

          rentByQuarter[quarterKey].push(item.price);
        }
      });
    }

    // 모든 분기 키 수집
    const allQuarters = new Set([
      ...Object.keys(buyByQuarter),
      ...Object.keys(rentByQuarter),
    ]);

    // 분기별 평균 계산
    const result = [];

    Array.from(allQuarters)
      .sort()
      .forEach((quarter) => {
        const buyPrices = buyByQuarter[quarter] || [];
        const rentPrices = rentByQuarter[quarter] || [];

        const buyAvg =
          buyPrices.length > 0
            ? buyPrices.reduce((sum, p) => sum + p, 0) / buyPrices.length
            : null;

        const rentAvg =
          rentPrices.length > 0
            ? rentPrices.reduce((sum, p) => sum + p, 0) / rentPrices.length
            : null;

        result.push({
          quarter,
          매매: buyAvg,
          전세: rentAvg,
          매매거래수: buyPrices.length,
          전세거래수: rentPrices.length,
        });
      });

    return result;
  };

  // 데이터 로딩 효과
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 파일 읽기 시도
        const response = await window.fs.readFile("paste.txt", {
          encoding: "utf8",
        });
        const lines = response.split("\n");

        // 파일이 너무 짧으면 오류
        if (lines.length < 4) {
          throw new Error("파일 데이터가 올바르지 않습니다.");
        }

        // 평형 타입 찾기
        const firstLine = lines[0];
        const sizeTypes = [];

        firstLine.split("\t").forEach((item) => {
          const trimmed = item.trim();
          if (trimmed && trimmed.includes("㎡")) {
            if (!sizeTypes.includes(trimmed)) {
              sizeTypes.push(trimmed);
            }
          }
        });

        if (sizeTypes.length === 0) {
          throw new Error("평형 데이터를 찾을 수 없습니다.");
        }

        console.log("데이터 로딩 - 평형:", sizeTypes);

        // 데이터 처리
        const processedData = {};

        // 각 평형별 데이터 처리
        sizeTypes.forEach((sizeType) => {
          const typeData = {
            매매: [],
            전세: [],
          };

          // 평형 시작 인덱스 찾기
          let typeStartIndex = -1;
          firstLine.split("\t").forEach((cell, index) => {
            if (cell.trim() === sizeType) {
              if (typeStartIndex === -1) {
                typeStartIndex = index;
              }
            }
          });

          if (typeStartIndex === -1) {
            console.log(`${sizeType}의 시작 인덱스를 찾을 수 없습니다.`);
            return;
          }

          console.log(`${sizeType} 시작 인덱스:`, typeStartIndex);

          // 데이터 파싱
          for (let i = 3; i < lines.length; i++) {
            if (!lines[i] || lines[i].trim() === "") continue;

            const cells = lines[i].split("\t");

            // 매매 데이터 확인 (첫 번째 열)
            if (
              cells[typeStartIndex] &&
              cells[typeStartIndex + 1] &&
              cells[typeStartIndex].trim() !== "" &&
              cells[typeStartIndex + 1].trim() !== ""
            ) {
              const date = cells[typeStartIndex].trim();
              const priceString = cells[typeStartIndex + 1].trim();

              try {
                // 가격 파싱 (예: "20억 7,000" -> 20.7)
                let price = 0;

                if (priceString.includes("억")) {
                  const parts = priceString
                    .replace(/[^\d억\.]/g, "")
                    .split("억");
                  const billionPart = parseFloat(parts[0]) || 0;
                  const millionPart = parts[1]
                    ? parseFloat(parts[1]) / 10000
                    : 0;
                  price = billionPart + millionPart;
                } else {
                  price =
                    parseFloat(priceString.replace(/[^\d\.]/g, "")) / 10000;
                }

                if (!isNaN(price) && price > 0) {
                  typeData.매매.push({
                    date,
                    price,
                  });
                }
              } catch (err) {
                console.error(
                  `매매가 파싱 오류 (${date}, ${priceString}):`,
                  err
                );
              }
            }

            // 전세 데이터 확인 (세 번째 열)
            if (
              cells[typeStartIndex + 2] &&
              cells[typeStartIndex + 3] &&
              cells[typeStartIndex + 2].trim() !== "" &&
              cells[typeStartIndex + 3].trim() !== ""
            ) {
              const date = cells[typeStartIndex + 2].trim();
              const priceString = cells[typeStartIndex + 3].trim();

              try {
                // 가격 파싱
                let price = 0;

                if (priceString.includes("억")) {
                  const parts = priceString
                    .replace(/[^\d억\.]/g, "")
                    .split("억");
                  const billionPart = parseFloat(parts[0]) || 0;
                  const millionPart = parts[1]
                    ? parseFloat(parts[1]) / 10000
                    : 0;
                  price = billionPart + millionPart;
                } else {
                  price =
                    parseFloat(priceString.replace(/[^\d\.]/g, "")) / 10000;
                }

                if (!isNaN(price) && price > 0) {
                  typeData.전세.push({
                    date,
                    price,
                  });
                }
              } catch (err) {
                console.error(
                  `전세가 파싱 오류 (${date}, ${priceString}):`,
                  err
                );
              }
            }
          }

          // 날짜 기준 정렬
          typeData.매매.sort(
            (a, b) =>
              new Date(a.date.replace(/\./g, "-")) -
              new Date(b.date.replace(/\./g, "-"))
          );
          typeData.전세.sort(
            (a, b) =>
              new Date(a.date.replace(/\./g, "-")) -
              new Date(b.date.replace(/\./g, "-"))
          );

          console.log(
            `${sizeType} 데이터 개수: 매매 ${typeData.매매.length}건, 전세 ${typeData.전세.length}건`
          );

          // 결과 저장
          processedData[sizeType] = typeData;
        });

        console.log("모든 평형 데이터 처리 완료");

        // 첫 번째 선택 평형 결정 - 원하는 순서로 찾기
        const desiredOrder = [
          "80B㎡",
          "82A㎡",
          "82C㎡",
          "117A㎡",
          "117B㎡",
          "141A㎡",
          "141B㎡",
        ];
        let defaultType = null;

        // 원하는 순서대로 검색해서 첫 번째로 존재하는 평형 선택
        for (const type of desiredOrder) {
          if (processedData[type]) {
            defaultType = type;
            break;
          }
        }

        // 없으면 첫 번째 평형 선택
        if (!defaultType && Object.keys(processedData).length > 0) {
          defaultType = Object.keys(processedData)[0];
        }

        setData(processedData);

        // 분기별 데이터 준비
        if (defaultType) {
          setSelectedType(defaultType);
          const quarterlyData = prepareQuarterlyData(
            processedData[defaultType]
          );
          setChartData(quarterlyData);
        }

        setLoading(false);
      } catch (err) {
        console.error("데이터 로딩 오류:", err);
        setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 원하는 순서로 평형 정렬
  const sortTypes = (types) => {
    const desiredOrder = [
      "80B㎡",
      "82A㎡",
      "82C㎡",
      "117A㎡",
      "117B㎡",
      "141A㎡",
      "141B㎡",
    ];
    return [...types].sort((a, b) => {
      return desiredOrder.indexOf(a) - desiredOrder.indexOf(b);
    });
  };

  // 평형 선택 처리
  const handleTypeSelect = (type) => {
    if (data[type]) {
      setSelectedType(type);
      const quarterlyData = prepareQuarterlyData(data[type]);
      setChartData(quarterlyData);
    }
  };

  // 로딩 중 표시
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <p className="text-lg text-gray-700 mb-2">
            데이터를 불러오는 중입니다...
          </p>
          <p className="text-sm text-gray-500">
            2010년부터 모든 거래 데이터를 처리 중입니다.
          </p>
        </div>
      </div>
    );
  }

  // 오류 발생 시 표시
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg shadow p-6">
        <p className="text-lg text-red-600 mb-3">{error}</p>
        <p className="text-base text-gray-700 mb-4">
          데이터 로딩 문제가 발생했습니다.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          새로고침하기
        </button>
      </div>
    );
  }

  // 데이터 없음
  if (!selectedType || Object.keys(data).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg shadow p-6">
        <p className="text-lg text-gray-700 mb-3">표시할 데이터가 없습니다.</p>
        <p className="text-sm text-gray-500 mb-4">
          데이터 파일을 다시 업로드해주세요.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          새로고침하기
        </button>
      </div>
    );
  }

  // 현재 선택된 평형 데이터
  const selectedData = data[selectedType];

  // 매매/전세 건수
  const saleCount =
    selectedData && selectedData.매매 ? selectedData.매매.length : 0;
  const rentCount =
    selectedData && selectedData.전세 ? selectedData.전세.length : 0;

  // 최신 가격 계산
  const getLatestPrice = (deals) => {
    if (!deals || deals.length === 0) return null;

    const sorted = [...deals].sort((a, b) => {
      return (
        new Date(b.date.replace(/\./g, "-")) -
        new Date(a.date.replace(/\./g, "-"))
      );
    });

    return sorted[0];
  };

  // 최고 가격 계산
  const getMaxPrice = (deals) => {
    if (!deals || deals.length === 0) return null;

    return deals.reduce((max, current) => {
      return current.price > max.price ? current : max;
    }, deals[0]);
  };

  // 가격 정보
  const latestSalePrice =
    selectedData && selectedData.매매.length > 0
      ? getLatestPrice(selectedData.매매)
      : null;
  const latestRentPrice =
    selectedData && selectedData.전세.length > 0
      ? getLatestPrice(selectedData.전세)
      : null;
  const maxSalePrice =
    selectedData && selectedData.매매.length > 0
      ? getMaxPrice(selectedData.매매)
      : null;
  const maxRentPrice =
    selectedData && selectedData.전세.length > 0
      ? getMaxPrice(selectedData.전세)
      : null;

  return (
    <div className="bg-gray-50 p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">방배삼호 매매/전세 가격 분석</h2>

      {/* 평형 선택 버튼 */}
      <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-2">
        {sortTypes(Object.keys(data)).map((type) => (
          <button
            key={type}
            onClick={() => handleTypeSelect(type)}
            className={`px-4 py-2 rounded-full text-sm md:text-base flex-none whitespace-nowrap ${
              selectedType === type
                ? "bg-blue-500 text-white font-medium"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* 현재 평형 정보 */}
      <div className="mb-4 bg-white p-4 rounded-lg shadow">
        <p className="text-base text-gray-700">
          <span className="font-semibold">{selectedType}</span> 거래 데이터:
          <span className="ml-3 inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            {saleCount}건 매매
          </span>
          <span className="ml-2 inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
            {rentCount}건 전세
          </span>
        </p>
        <p className="text-xs text-gray-500 mt-2">
          정렬 순서: 80B㎡, 82A㎡, 82C㎡, 117A㎡, 117B㎡, 141A㎡, 141B㎡
        </p>
      </div>

      {/* 가격 정보 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {latestSalePrice && (
          <div className="bg-white rounded-lg p-4 shadow h-full">
            <h3 className="text-sm md:text-base text-gray-600 font-medium">
              최신 매매가
            </h3>
            <p className="text-xl md:text-2xl font-bold text-blue-600 mt-1">
              {latestSalePrice.price.toFixed(1)}억원
            </p>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              {latestSalePrice.date}
            </p>
          </div>
        )}

        {latestRentPrice && (
          <div className="bg-white rounded-lg p-4 shadow h-full">
            <h3 className="text-sm md:text-base text-gray-600 font-medium">
              최신 전세가
            </h3>
            <p className="text-xl md:text-2xl font-bold text-blue-600 mt-1">
              {latestRentPrice.price.toFixed(1)}억원
            </p>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              {latestRentPrice.date}
            </p>
          </div>
        )}

        {maxSalePrice && (
          <div className="bg-white rounded-lg p-4 shadow h-full">
            <h3 className="text-sm md:text-base text-gray-600 font-medium">
              최고 매매가
            </h3>
            <p className="text-xl md:text-2xl font-bold text-blue-600 mt-1">
              {maxSalePrice.price.toFixed(1)}억원
            </p>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              {maxSalePrice.date}
            </p>
          </div>
        )}

        {maxRentPrice && (
          <div className="bg-white rounded-lg p-4 shadow h-full">
            <h3 className="text-sm md:text-base text-gray-600 font-medium">
              최고 전세가
            </h3>
            <p className="text-xl md:text-2xl font-bold text-blue-600 mt-1">
              {maxRentPrice.price.toFixed(1)}억원
            </p>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              {maxRentPrice.date}
            </p>
          </div>
        )}
      </div>

      {/* 차트 */}
      {chartData.length > 0 ? (
        <div className="bg-white p-4 rounded-lg shadow h-72 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 12 }}
                allowDecimals={true}
                tickCount={7}
              />
              <Tooltip
                formatter={(value) =>
                  value ? `${value.toFixed(1)}억원` : "데이터 없음"
                }
                labelFormatter={(label) => {
                  const [year, quarter] = label.split("Q");
                  return `${year}년 ${quarter}분기`;
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line
                type="monotone"
                dataKey="매매"
                name="매매가"
                stroke="#2563eb"
                activeDot={{ r: 6 }}
                connectNulls={true}
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="전세"
                name="전세가"
                stroke="#10b981"
                activeDot={{ r: 6 }}
                connectNulls={true}
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white p-4 rounded-lg shadow h-72 md:h-80 flex items-center justify-center">
          <p className="text-gray-500">
            선택한 평형의 그래프 데이터가 없습니다.
          </p>
        </div>
      )}

      {/* 거래량 표시 */}
      {chartData.length > 0 ? (
        <div className="mt-4 bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">분기별 거래 건수</h3>
          <div className="h-40 md:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => (value ? `${value}건` : "0건")}
                  labelFormatter={(label) => {
                    const [year, quarter] = label.split("Q");
                    return `${year}년 ${quarter}분기`;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="매매거래수"
                  name="매매 거래수"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  connectNulls={true}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="전세거래수"
                  name="전세 거래수"
                  stroke="#10b981"
                  strokeWidth={2}
                  connectNulls={true}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="mt-4 bg-white p-4 rounded-lg shadow h-40 flex items-center justify-center">
          <p className="text-gray-500">
            선택한 평형의 거래량 데이터가 없습니다.
          </p>
        </div>
      )}

      {/* 부동산 뉴스 섹션 */}
      <div className="mt-6">
        <h3 className="text-lg font-bold mb-3">최근 부동산 뉴스</h3>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="flex items-start mb-4">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-navy-600"
                fill="#0F3E84"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                ></path>
              </svg>
            </div>
            <div className="ml-2">
              <p className="text-navy-800 font-bold text-base md:text-lg">
                2025년 2월 방배 래미안 원페를라 분양가
              </p>
              <p className="text-gray-700 mt-1 text-sm md:text-base">
                59㎡는 16억1690만~17억9650만원, 전용 84㎡는
                22억560만~24억5070만원
              </p>
              <p className="text-xs text-gray-500 mt-1">2025년 02월 15일</p>
            </div>
          </div>

          <div className="flex items-start">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-navy-600"
                fill="#0F3E84"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                ></path>
              </svg>
            </div>
            <div className="ml-2">
              <p className="text-navy-800 font-bold text-base md:text-lg">
                2024년 10월 '방배 그랑자이' 거래가
              </p>
              <p className="text-gray-700 mt-1 text-sm md:text-base">
                전용 84㎡는 29억3000만원에 거래 완료
              </p>
              <p className="text-xs text-gray-500 mt-1">2024년 10월 30일</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleChart;
