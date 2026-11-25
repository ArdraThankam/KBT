-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 10.5.95.59
-- Generation Time: Oct 27, 2026 at 05:34 AM
-- Server version: 8.0.46-0ubuntu0.22.04.2
-- PHP Version: 8.2.27

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `village_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `taluks`
--

CREATE TABLE `taluks` (
  `id` int NOT NULL,
  `country_id` int NOT NULL,
  `state_id` int NOT NULL,
  `taluk_district_id` int NOT NULL,
  `page_id` int DEFAULT NULL,
  `taluk_code` varchar(100) NOT NULL,
  `abbr` varchar(50) NOT NULL,
  `taluk_name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT 'Name',
  `description` varchar(500) NOT NULL,
  `created_by` int NOT NULL COMMENT 'Created By',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Created On',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `status` int NOT NULL,
  `del` int NOT NULL DEFAULT '0',
  `json` longtext,
  `json_log` longtext
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dumping data for table `taluks`
--

INSERT INTO `taluks` (`id`, `country_id`, `state_id`, `taluk_district_id`, `page_id`, `taluk_code`, `abbr`, `taluk_name`, `description`, `created_by`, `created_at`, `updated_at`, `updated_by`, `status`, `del`, `json`, `json_log`) VALUES
(1, 102, 48, 1614, NULL, '5691', 'TVPM', 'Thiruvananthapuram', 'asssssss', 1111111, '2020-01-09 06:10:00', '2024-09-09 12:17:22', 1, 1, 0, '{\"Action\":\"Update\",\"User\":1,\"on\":\"2024-09-09 12:09:22\",\"page_id\":null,\"country_id\":\"102\",\"state_id\":\"48\",\"taluk_district_id\":\"1614\",\"taluk_code\":\"5691\",\"abbr\":\"aas\",\"taluk_name\":\"Thiruvananthapuram\",\"description\":\"asssssss\",\"status\":\"1\",\"updated_by\":1,\"del\":0,\"updated_at\":\"2024-09-09 12:09:22\"}', '[{\"Action\":\"Update\",\"User\":1,\"on\":\"2024-09-09 12:09:22\",\"page_id\":null,\"country_id\":\"102\",\"state_id\":\"48\",\"taluk_district_id\":\"1614\",\"taluk_code\":\"5691\",\"abbr\":\"aas\",\"taluk_name\":\"Thiruvananthapuram\",\"description\":\"asssssss\",\"status\":\"1\",\"updated_by\":1,\"del\":0,\"updated_at\":\"2024-09-09 12:09:22\"}]'),
(2, 0, 0, 1614, NULL, '5689', 'CKZ', 'Chirayinkeezh', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(3, 0, 0, 1614, NULL, '5692', 'NYTR', 'Neyyattinkara', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(4, 0, 0, 1614, NULL, '5690', 'NDD', 'Nedumangad', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(5, 0, 0, 1614, NULL, '5945', 'KTKD', 'Kattakada', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(6, 0, 0, 1614, NULL, '5946', 'VRKL', 'Varkala', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(7, 0, 0, 1613, NULL, '5688', 'KLM', 'Kollam', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(8, 0, 0, 1613, NULL, '5687', 'KTR', 'Kottarakkara', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(9, 0, 0, 1613, NULL, '5686', 'PPM', 'Pathanapuram', '', 1111111, '2020-01-09 08:34:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(10, 0, 0, 1613, NULL, '5684', 'KNPY', 'Karunagappally', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(11, 0, 0, 1613, NULL, '5685', 'KNTR', 'Kunnathur', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(12, 0, 0, 1613, NULL, '5947', 'PLR', 'Punalur', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(13, 0, 0, 1612, NULL, '5682', 'KZHY', 'Kozhenchery', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(14, 0, 0, 1612, NULL, '5683', 'ADR', 'Adoor', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(15, 0, 0, 1612, NULL, '5943', 'KNI', 'Konni', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(16, 0, 0, 1612, NULL, '5679', 'TVLA', 'Thiruvalla', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(17, 0, 0, 1612, NULL, '5681', 'RNI', 'Ranni', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(18, 0, 0, 1612, NULL, '5680', 'MLPY', 'Mallappally', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(19, 0, 0, 1611, NULL, '5676', 'KPLY', 'Karthikappally', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(20, 0, 0, 1611, NULL, '5678', 'MVLK', 'Mavelikkara', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(21, 0, 0, 1611, NULL, '5677', 'CGNR', 'Chengannur', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(22, 0, 0, 1611, NULL, '5675', 'KTND', 'Kuttanad', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(23, 0, 0, 1611, NULL, '5674', 'AMPZ', 'Ambalappuzha', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(24, 0, 0, 1611, NULL, '5673', 'CHTL', 'Cherthala', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(25, 0, 0, 1610, NULL, '5671', 'CHY', 'Changanassery', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(26, 0, 0, 1610, NULL, '5672', 'KPY', 'Kanjirappally', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(27, 0, 0, 1610, NULL, '5670', 'KTM', 'Kottayam', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(28, 0, 0, 1610, NULL, '5668', 'MCL', 'Meenachil', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(29, 0, 0, 1610, NULL, '5669', 'VKM', 'Vaikom', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(30, 0, 0, 1609, NULL, '5666', 'TDP', 'Thodupuzha', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(31, 0, 0, 1609, NULL, '5942', 'IDK', 'Idukki', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(32, 0, 0, 1609, NULL, '5667', 'PMD', 'Peerumade', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(33, 0, 0, 1609, NULL, '5664', 'DVM', 'Devikulam', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(34, 0, 0, 1609, NULL, '5665', 'UDC', 'Udumbanchola', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(35, 0, 0, 1608, NULL, '5663', 'KMG', 'Kothamangalam', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(36, 0, 0, 1608, NULL, '5662', 'MVP', 'Moovattupuzha', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(37, 0, 0, 1608, NULL, '5657', 'KND', 'Kunnathunad', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(38, 0, 0, 1608, NULL, '5658', 'ALV', 'Aluva', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(39, 0, 0, 1608, NULL, '5661', 'KNR', 'Kanayannor', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(40, 0, 0, 1608, NULL, '5660', 'KCI', 'Kochi', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(41, 0, 0, 1608, NULL, '5659', 'PVR', 'Paravur', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(42, 0, 0, 1607, NULL, '5654', 'KKM', 'Kunnamkulam', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(43, 0, 0, 1607, NULL, '5654', 'TSR', 'Thrissur', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(44, 0, 0, 1607, NULL, '5653', 'CKD', 'Chavakkad', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(45, 0, 0, 1607, NULL, '5652', 'TLPY', 'Thalappilly', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(46, 0, 0, 1607, NULL, '5939', 'CKDY', 'Chalakkudy', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(47, 0, 0, 1607, NULL, '5655', 'KDGL', 'Kodungallur', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(48, 0, 0, 1607, NULL, '5656', 'MKDP', 'Mukundapuram', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(49, 0, 0, 1606, NULL, '5650', 'CTR', 'Chittur', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(50, 0, 0, 1606, NULL, '5651', 'ALR', 'Alathur', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(51, 0, 0, 1606, NULL, '5649', 'PKD', 'Palakkad', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(52, 0, 0, 1606, NULL, '5647', 'OTP', 'Ottappalam', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(53, 0, 0, 1606, NULL, '5648', 'MKD', 'Mannarkad', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(54, 0, 0, 1606, NULL, '5940', 'PTB', 'Pattambi', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(55, 0, 0, 1605, NULL, '5646', 'PNI', 'Ponnani', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(56, 0, 0, 1605, NULL, '5644', 'TIR', 'Tirur', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(57, 0, 0, 1605, NULL, '5645', 'TDI', 'Tirurangadi', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(58, 0, 0, 1605, NULL, '5941', 'KDT', 'Kondotty', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(59, 0, 0, 1605, NULL, '5643', 'PTM', 'Perinthalmanna', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(60, 0, 0, 1605, NULL, '5641', 'ERD', 'Ernad', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(61, 0, 0, 1605, NULL, '5642', 'NBR', 'Nilambur', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(62, 0, 0, 1604, NULL, '5640', 'KKD', 'Kozhikode', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(63, 0, 0, 1604, NULL, '5639', 'KLY', 'Koyilandy', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(64, 0, 0, 1604, NULL, '5638', 'VKA', 'Vatakara', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(65, 0, 0, 1604, NULL, '5938', 'TMY', 'Thamarassery', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(66, 0, 0, 1603, NULL, '5636', 'SBY', 'Sulthanbathery', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(67, 0, 0, 1603, NULL, '5637', 'VTR', 'Vythiri', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(68, 0, 0, 1603, NULL, '5635', 'MDY', 'Mananthavady', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(69, 0, 0, 1602, NULL, '5634', 'TLY', 'Thalassery', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(70, 0, 0, 1602, NULL, '5633', 'KNR', 'Kannur', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(71, 0, 0, 1602, NULL, '6599', 'PAY', 'Payyannur', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(72, 0, 0, 1602, NULL, '6599', 'TLPB', 'Taliparamba', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(73, 0, 0, 1602, NULL, '5937', 'IRT', 'Iritty', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(74, 0, 0, 1601, NULL, '5631', 'HSD', 'Hosdurg', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(75, 0, 0, 1601, NULL, '5933', 'VRK', 'Vellarikkundu', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(76, 0, 0, 1601, NULL, '5630', 'KSD', 'Kasargod', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(77, 0, 0, 1601, NULL, '5932', 'MJR', 'Manjeswaram', '', 1111111, '2020-01-09 06:10:00', '0000-00-00 00:00:00', 0, 1, 0, '', NULL),
(78, 102, 48, 1606, NULL, '1111', 'ATP', 'Attappadi', 'saaaaaaaaaa', 1111111, '2022-02-24 22:50:19', '2024-09-09 12:17:03', 1, 1, 0, '{\"Action\":\"Update\",\"User\":1,\"on\":\"2024-09-09 12:09:03\",\"page_id\":null,\"country_id\":\"102\",\"state_id\":\"48\",\"taluk_district_id\":\"1606\",\"taluk_code\":\"1111\",\"abbr\":\"pal\",\"taluk_name\":\"Attappadi\",\"description\":\"saaaaaaaaaa\",\"status\":\"1\",\"updated_by\":1,\"del\":0,\"updated_at\":\"2024-09-09 12:09:03\"}', '[{\"Action\":\"disable\",\"User\":1,\"On\":\"2024-09-09 12:09:40\",\"country_id\":0,\"state_id\":0,\"taluk_district_id\":1606,\"taluk_code\":\"1111\",\"abbr\":\"\",\"taluk_name\":\"Attappadi\",\"description\":\"\",\"status\":2,\"updated_by\":1,\"del\":0,\"updated_at\":\"2024-09-09 12:09:40\"},{\"Action\":\"enable\",\"User\":1,\"On\":\"2024-09-09 12:09:43\",\"country_id\":0,\"state_id\":0,\"taluk_district_id\":1606,\"taluk_code\":\"1111\",\"abbr\":\"\",\"taluk_name\":\"Attappadi\",\"description\":\"\",\"status\":1,\"updated_by\":1,\"del\":0,\"updated_at\":\"2024-09-09 12:09:43\"},{\"Action\":\"Update\",\"User\":1,\"on\":\"2024-09-09 12:09:31\",\"page_id\":null,\"country_id\":\"102\",\"state_id\":\"48\",\"taluk_district_id\":\"1606\",\"taluk_code\":\"1111\",\"abbr\":\"pal\",\"taluk_name\":\"Attappadi 5565\",\"description\":\"saaaaaaaaaa\",\"status\":\"1\",\"updated_by\":1,\"del\":0,\"updated_at\":\"2024-09-09 12:09:31\"},{\"Action\":\"Update\",\"User\":1,\"on\":\"2024-09-09 12:09:03\",\"page_id\":null,\"country_id\":\"102\",\"state_id\":\"48\",\"taluk_district_id\":\"1606\",\"taluk_code\":\"1111\",\"abbr\":\"pal\",\"taluk_name\":\"Attappadi\",\"description\":\"saaaaaaaaaa\",\"status\":\"1\",\"updated_by\":1,\"del\":0,\"updated_at\":\"2024-09-09 12:09:03\"}]');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `taluks`
--
ALTER TABLE `taluks`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `taluks`
--
ALTER TABLE `taluks`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=79;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
