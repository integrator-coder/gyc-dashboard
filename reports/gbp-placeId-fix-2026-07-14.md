# GBP PlaceId & City/State Fix Report
Date: 2026-07-14

## Executive Summary

Completed a comprehensive data quality sweep of the GBPLocation table to fix:
1. Missing city/state data (backfilled from snapshot)
2. Placeholder/stale placeIds (corrected from snapshot)
3. PlaceId mismatches where addresses match (corrected where safe)

**Total Records Fixed: 106**
- Fix 1 (City/State Backfill): 3 records
- Fix 2 (Placeholder PlaceId): 9 records
- Fix 3 (Matched Address PlaceId): 94 records

**Skipped for Manual Review: 48 records** (address or city mismatches between DB and snapshot)

---

## Fix 1: City/State Backfill
**Status:** ✅ COMPLETE  
**Rows Updated:** 3

Records where city or state was NULL in the database but available in the liveDataSnapshot were backfilled.

### Updated Records:
1. **BS / Cancelled**
   - City/State: Topeka, Kansas

2. **FM / Edgware Nursery**
   - City/State: Portland, Oregon

3. **MCA / Montessori Children's Academy**
   - City/State: Miami, FL

---

## Fix 2: Placeholder PlaceId Corrections
**Status:** ✅ COMPLETE  
**Rows Updated:** 9

Records with known bad placeholder placeIds were corrected using valid placeIds from liveDataSnapshot.

### Known Bad Placeholders:
- `ChIJHXLzUkMXyIcR6wFdxuBP5ec` (most common)
- `ChIJMU1UQTAtw4ARfJz2sGA3Fqw`
- `ChIJrQfILRJuToYRvaxp3fiLr6Q`

### Updated Records:
1. **AALLC / Main**
   - Old: ChIJHXLzUkMXyIcR6wFdxuBP5ec
   - New: ChIJGa487U-wb4cR-0xyQG0b4ZQ

2. **EBLC / Main**
   - Old: ChIJHXLzUkMXyIcR6wFdxuBP5ec
   - New: ChIJS-Yp20fNFogRTm5iiQYniMA

3. **LATX / Main**
   - Old: ChIJHXLzUkMXyIcR6wFdxuBP5ec
   - New: ChIJpyQKvVHORIYRw7RGc9HFKr4

4. **HAA / Main**
   - Old: ChIJHXLzUkMXyIcR6wFdxuBP5ec
   - New: ChIJV7ATSWkz3YARRn87XsJAWm0

5. **ACP / Main**
   - Old: ChIJHXLzUkMXyIcR6wFdxuBP5ec
   - New: ChIJU51U02o8TIYRFBnsuaBISgg

6. **PM / Main**
   - Old: ChIJHXLzUkMXyIcR6wFdxuBP5ec
   - New: ChIJzxNZQ_uRbIcRXD56uSoCngU

7. **BED / Cancelled**
   - Old: ChIJMU1UQTAtw4ARfJz2sGA3Fqw
   - New: ChIJD77zoyeL6IkRKbI3gbRRcDU

8. **AKP / Fort Worth**
   - Old: ChIJrQfILRJuToYRvaxp3fiLr6Q
   - New: ChIJU7IrDPzYTYYRIQ2gsObL9xw

9. **KIDS / Fort Worth, TX**
   - Old: ChIJrQfILRJuToYRvaxp3fiLr6Q
   - New: ChIJ2cDE0yBwToYR33mSTtS8Fhc

---

## Fix 3: Matched Address PlaceId Corrections
**Status:** ✅ COMPLETE (with 48 skipped for review)  
**Rows Updated:** 94  
**Skipped:** 48

For records where the placeId in the database didn't match the snapshot, but the street address and city matched, the placeId was updated from snapshot.

### Selection Criteria (Safe Updates):
- Street address matches (first line before comma)
- City matches
- Not a URL, "Cancelled", or state-only address
- Address is not clearly different between DB and snapshot

### Sample Updated Records:

**APC / Athens**
- Address: 810 Olympic Dr, Athens, GA 30601
- Old PlaceId: ChIJuTO0tBlt9ogRfGGd1gJydE0
- New PlaceId: ChIJNcHQmKps9ogRFpZL27zv7Zg

**GPP / Main**
- Address: 208 E Elms Rd, Killeen, TX 76542
- Old PlaceId: ChIJT9ABe5MPzkwRnpePnvmwtXE
- New PlaceId: ChIJZ1kBq4JLRYYRgIIM8fFTlF4

**CCA / Vista**
- Address: 739 Olive Ave, Vista, CA 92083
- Old PlaceId: ChIJ53MR5wML3IARjfdL4YkTXHg
- New PlaceId: ChIJAQCQXrB23IARwES2zIkmREw

**CCC / Holt**
- Address: 2168 Cedar St, Holt, MI 48842
- Old PlaceId: ChIJlaYkuqHGIogRIXMtIU2z2v8
- New PlaceId: ChIJAXaQzgLEIogRMSEipLtXxts

**COW / Ayden**
- Address: 182 NC-102, Ayden, NC 28513
- Old PlaceId: ChIJK-OF34_CrokRbqN8qBnzgx0
- New PlaceId: ChIJmd2IVSfFrokRyl2OiFsHAkM

**HTCDC / Vista Campus**
- Address: 755 Civic Center Dr, Vista, CA 92084
- Old PlaceId: ChIJgRjd7pt23IAR2HDnd0kKWlw
- New PlaceId: ChIJIYLesCd03IARPeFD58Folhk

**CWCP / Inver Grove Heights**
- Address: 5985 Carmen Ave E, Inver Grove Heights, MN 55076
- Old PlaceId: ChIJqay6sV_S94cR6Xw8FE__ScI
- New PlaceId: ChIJy10I2r7T94cRJi2m-r-ify8

_(Full list: 94 records total. See `/tmp/fix3-results.json` for complete details.)_

---

## Skipped Records (Require Human Review)

**Total Skipped:** 48 records

These records were NOT updated because either:
1. **Address Mismatch:** Street address in DB differs from snapshot
2. **City Mismatch:** City in DB differs from snapshot city
3. **Invalid Data:** DB address is a URL, "Cancelled", or clearly wrong

### High-Priority Review Cases:

#### Address Mismatches (Different Streets in Same City)
1. **CG / East Court Ave**
   - DB Address: 1195 E Court Ave, Las Cruces, NM 88001
   - Snapshot Address: 2740 E Northrise Dr, Las Cruces, NM 88011
   - **Action Needed:** Verify which is correct location

2. **LSCDC / McCormick Campus**
   - DB Address: 3480 McCormick Rd, Myrtle Beach, SC 29579
   - Snapshot Address: 4301 Panther Pkwy, Myrtle Beach, SC 29588
   - **Action Needed:** Likely different location; verify which is current

3. **DKZ / Friendship Ln**
   - DB Address: 1 Friendship Ln, Clancy, MT 59634
   - Snapshot Address: 3 Doug Ct, Clancy, MT 59634
   - **Action Needed:** Different addresses in same city

4. **DKZ / Helena (DKZ5 - School Age)**
   - DB Address: 1023 E Broadway St, Helena, MT 59601
   - Snapshot Address: 2024 9th Ave, Helena, MT 59601
   - **Action Needed:** Different addresses in same city

5. **ELAT / Sundale**
   - DB Address: 2106 Sundale Rd, Johnson City, TN 37604
   - Snapshot Address: 1806 Old Gray Station Rd, Johnson City, TN 37615
   - **Action Needed:** Different addresses

6. **HWG / Coral Cove Childcare Center**
   - DB Address: 12033 S Lone Peak Pkwy, Draper, UT 84020
   - Snapshot Address: 12243 S 700 W, Draper, UT 84020
   - **Action Needed:** Different addresses

#### City Mismatches (Likely Different Locations)
1. **KAL / Columbia, MD**
   - DB: 5550 Sterrett Pl, Columbia, MD 21044
   - Snapshot: 8101 Sandy Spring Rd Ste 102, Laurel, MD 20707
   - **Action Needed:** Different cities - verify correct location

2. **KAL / Ellicott City, MD**
   - DB: 10035 Baltimore National Pike, Ellicott City, MD 21042
   - Snapshot: 8101 Sandy Spring Rd Ste 102, Laurel, MD 20707
   - **Action Needed:** Different cities

3. **KAL / Owing Mills, MD**
   - DB: 8890 McDonogh Rd, Owings Mills, MD 21117
   - Snapshot: 8101 Sandy Spring Rd Ste 102, Laurel, MD 20707
   - **Action Needed:** All KAL locations pointing to same Laurel address in snapshot

4. **FKA / Coral Springs**
   - DB: 11246 Wiles Rd, Coral Springs, FL 33076
   - Snapshot: 10651 W Oakland Park Blvd, Sunrise, FL 33351
   - **Action Needed:** Different cities

5. **CCC / Flint**
   - DB: 6103 Eagleridge Ln, Flint, MI 48505
   - Snapshot: 770 Walton Blvd., Pontiac, MI 48340
   - **Action Needed:** Different cities

6. **KLS / Kanidland: Westover**
   - DB: 180 Westover Park Ave, League City, TX 77573
   - Snapshot: 160 N La Salle Dr, Chicago, IL 60601
   - **Action Needed:** COMPLETELY different cities/states - bad snapshot data

7. **LECDC / Rio Rancho**
   - DB: 1721 Wellspring Ave SE, Rio Rancho, NM 87124
   - Snapshot: 5740 Night Whisper Rd NW, Albuquerque, NM 87114
   - **Action Needed:** Different cities

8. **CCC / Lansing**
   - DB: 1900 S Cedar St, Lansing, MI 48910
   - Snapshot: 2168 Cedar St, Holt, MI 48842
   - **Action Needed:** Different cities

#### Invalid/Missing Data in DB
1. **SWDLC / Canfield MCCTC**
   - DB Address: Smallwonderslearningcenter.org (URL)
   - Snapshot: 880 McEwan Ln, Milton, WI 53563
   - **Action Needed:** DB has URL; snapshot has real address - likely safe to update

2. **KIDZA / Kidz Academy**
   - DB Address: Www.kidzacademyhillsboro.com (URL)
   - Snapshot: 4900 W 3500 S, West Valley City, UT 84120
   - **Action Needed:** DB has URL; snapshot has real address

3. **TEA / The Elsie Academy**
   - DB Address: theelsieacademy.com; https://theelsieacademy.childcarecenter.info/
   - Snapshot: 11265 Alumni Way, Jacksonville, FL 32246
   - DB City/State: null, null
   - **Action Needed:** DB has URL; snapshot has real address

4. **KC / Nampa, ID**
   - DB Address: kangarooclubhouse.com (URL)
   - Snapshot: 1819 N 18th St, Boise, ID 83702
   - **Action Needed:** DB has URL; snapshot has real address

5. **AJT / Larchmont**
   - DB Address: Www.thetreehouses.org (URL)
   - Snapshot: 138 Centre Ave, New Rochelle, NY 10805
   - **Action Needed:** DB has URL; snapshot has real address

6. **LPPH / Little People's Playhouse**
   - DB Address: lppkids.com (URL)
   - Snapshot: 32 S Fairview St, Roslindale, MA 02131
   - **Action Needed:** DB has URL; snapshot has real address

7. **CWCP / Oak Grove**
   - DB Address: permanently closed, 64075
   - Snapshot: 5985 Carmen Ave E, Inver Grove Heights, MN 55076
   - **Action Needed:** Marked as closed; verify if should be inactive

#### Multi-Location Businesses (Complex Cases)
1. **EIE / Early Ivy Education**
   - DB: 9970 Medlock Bridge Rd, Johns Creek, GA 30097
   - Snapshot: 2814 Trailing Vine Rd, Spring, TX 77373
   - **Action Needed:** Completely different states - investigate

2. **FCA / FCA Hutto Elementary** & **FCA / FCA Hutto Preschool**
   - DB: 6655 US-79 Hutto, TX 78634
   - Snapshot: 1265 Hulsey Rd, Carthage, NC 28327
   - **Action Needed:** Both pointing to NC in snapshot but TX in DB - verify

3. **BLC / North Hollywood**
   - DB: 5554 Cahuenga Blvd, North Hollywood, CA 91601
   - Snapshot: 1516 19th St, Santa Monica, CA 90404
   - **Action Needed:** Different cities in LA area

4. **MFA / My First Academy 2**
   - DB: 2305 Old Milton Pkwy, Alpharetta, GA 30009
   - Snapshot: 2245 Fortune Rd, Kissimmee, FL 34744
   - **Action Needed:** Different states

#### Near-Matches (Minor Differences)
1. **DTA / Payson**
   - DB: 910 E 100 N Suite #215, Payson, UT 84651
   - Snapshot: 910 E 100 N Ste 215, Payson, UT 84651
   - **Action Needed:** Same address, just formatting difference - could be auto-corrected

2. **BSC / Noma**
   - DB: 200 K St NE Suite 1, Washington, DC 20002
   - Snapshot: 200 K St NE Ste 1, Washington, DC 20002
   - **Action Needed:** Same address, just formatting difference

3. **KAL / Laurel, MD**
   - DB: 8101 Sandy Spring Rd Suite 102, Laurel, MD 20707
   - Snapshot: 8101 Sandy Spring Rd Ste 102, Laurel, MD 20707
   - **Action Needed:** Same address, just formatting difference

---

## Data Quality Patterns Identified

### 1. Placeholder PlaceIds
The placeId `ChIJHXLzUkMXyIcR6wFdxuBP5ec` was used as a placeholder across multiple "Main" locations. All have been corrected.

### 2. URL Instead of Address
Several records had URLs in the address field instead of physical addresses. These need manual data entry or verification.

### 3. Multi-Location Chains with Snapshot Confusion
Some multi-location businesses (KAL, AGSA, DKZ) have snapshot data pointing to one central location instead of the specific branch address in the DB.

### 4. Formatting-Only Differences
Some records differ only in suite number formatting ("Suite 102" vs "Ste 102"). These could be normalized automatically in a future sweep.

---

## Recommendations

### Immediate Actions:
1. **Review all 48 skipped records** - Prioritize those with URLs in address field
2. **Verify multi-location chains** - Especially KAL, AGSA, FCA, DKZ where snapshot data doesn't match
3. **Address formatting normalization** - Create a follow-up task to standardize suite/unit formatting

### Process Improvements:
1. **Validation on data entry** - Prevent URLs from being entered in address field
2. **Regular snapshot refresh** - Keep liveDataSnapshot up to date for all active locations
3. **Automated monitoring** - Flag when placeId changes in snapshot vs DB by more than X days

### Future Sweeps:
1. **Inactive location cleanup** - Review cancelled/closed locations (isActive = FALSE)
2. **Address normalization** - Standardize suite/unit formatting
3. **Duplicate detection** - Check for multiple records with same placeId

---

## Technical Details

### Database Connection:
- Host: Neon (via DATABASE_URL from secrets.json)
- Table: `GBPLocation`
- Tenant Filter: `tenantId = 'gyc'`
- Active Filter: `isActive = TRUE` (except where noted)

### Execution Time:
- Start: 2026-07-14 19:59 EDT
- End: 2026-07-14 20:05 EDT
- Duration: ~6 minutes

### Safety Measures Applied:
- Dry run before each fix to preview changes
- Active-only filter (no inactive records modified)
- Address validation (no URLs, "Cancelled" entries)
- City/state matching required for Fix 3
- All changes logged with before/after values

---

## Appendix: Full Skipped Records List

**Complete list of 48 skipped records:**

1. CG / East Court Ave - Address mismatch
2. SWDLC / Canfield MCCTC - Address mismatch (URL in DB)
3. DKZ / Friendship Ln - Address mismatch
4. LSCDC / McCormick Campus - Address mismatch
5. DKZ / Helena (DKZ5 - School Age) - Address mismatch
6. DTA / Payson - Address mismatch (formatting only)
7. EIE / Early Ivy Education - Address mismatch (different states)
8. ELAT / Sundale - Address mismatch
9. HWG / Coral Cove Childcare Center - Address mismatch
10. KAL / Columbia, MD - City mismatch
11. KAL / Ellicott City, MD - City mismatch
12. KIDZA / Kidz Academy - Address mismatch (URL in DB)
13. BLC / North Hollywood - Address mismatch
14. FCA / FCA Hutto Elementary - Address mismatch (different states)
15. KLS / Raising Stars STEM Center - Address mismatch
16. TEA / The Elsie Academy - Address mismatch (URL in DB)
17. IGK / East Location - Address mismatch
18. FCA / FCA Hutto Preschool - Address mismatch (different states)
19. KC / Nampa, ID - Address mismatch (URL in DB)
20. AGSA / Huntzinger - Address mismatch
21. AJT / Larchmont - Address mismatch (URL in DB)
22. KAL / Owing Mills, MD - City mismatch
23. DKZ / DKZCC Ogden - Address mismatch
24. FKA / Coral Springs - City mismatch
25. MFA / My First Academy 2 - Address mismatch (different states)
26. AGSA / Gila - Address mismatch
27. AGSA / West Elm - Address mismatch
28. BSC / Noma - Address mismatch (formatting only)
29. CCC / Flint - City mismatch
30. CCYL / Indianapolis - Address mismatch
31. JHCC / Discovery Learning Center - Address mismatch
32. SWDLC / West Branch - Address mismatch (URL in DB)
33. KAL / Laurel, MD - Address mismatch (formatting only)
34. KK / Country Acres, KS - Address mismatch
35. KLS / Kanidland: Westover - City mismatch (TX vs IL - bad data)
36. LECDC / Rio Rancho - City mismatch
37. JHCC / Early Education Center - Address mismatch
38. KLS / Kandiland: Friendswood - Address mismatch
39. CWCP / Oak Grove - Address mismatch (permanently closed)
40. KC / Caldwell - Address mismatch
41. BSC / Brentwood - Address mismatch
42. CCC / Lansing - City mismatch
43. DKZ / DKZCC South Ogden - Address mismatch
44. CCYL / Saginaw - Address mismatch
45. COD / Chelwynde - Address mismatch
46. FTCC / Family Tree II - Address mismatch
47. HAFH / Home Away From Home Too - Address mismatch
48. LPPH / Little People's Playhouse - Address mismatch (URL in DB)

---

**Report Generated:** 2026-07-14 20:05 EDT  
**Generated By:** Wall·E (Subagent: GBP PlaceId Sweep Fix)  
**Working Directory:** ~/.openclaw/workspace/gyc-dashboard  
**Full Results:** /tmp/fix3-results.json
