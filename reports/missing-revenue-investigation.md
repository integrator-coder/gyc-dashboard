# Missing revenue investigation

Generated: 2026-04-23T18:54:49.584Z

## Summary

- Zero/null-MRR client profiles: 185
- Missing legacy stripeCustomerId: 87
- Has legacy stripeCustomerId: 98
- Safe auto-fix candidates found: 0
- Manual-review candidates: 25
- Likely true zero / no-billing cases: 160

## Breakdown

1. Shared live Stripe IDs already attached to zero-MRR profiles: 2 ($3,582.50 live MRR, but shared/ambiguous)
2. Safe non-email auto-fix candidates: 0
3. Email-only suspected matches: 22 ($17,158.49 potential MRR, manual review only)
4. Mixed / multi-candidate matches: 1 ($790.00 candidate MRR across options)
5. Legacy live Stripe rows with zero Stripe MRR: 96
6. No live Stripe evidence at all: 64

## AFYA

- AFYA (Academy for Young Achievers) has no stripeCustomerId on ClientProfile and MRR = 0.
- Closest live Stripe candidate: cus_LxIvsCtyY09YHy · Tori Wallace · $197.00 · signals: email
- Why not auto-fixed: email-only match (academyforyoungachievers@gmail.com); no company/acronym/GHL confirmation on the ClientProfile row.

## Shared live Stripe IDs requiring Lex review

### 1. KLC · Kidstown Learning Center

- Legacy Stripe: cus_T6SGYZlDqyNQaC · $2,629.00 · active
- Signals: legacy, ghl, acronym, email
- Shared with: GKLC / Growing Kids Learning Centers

### 2. RCDC · Rosebrook Child Development Center

- Legacy Stripe: cus_JWTZsZr9lB8qcJ · $953.50 · active
- Signals: legacy, ghl, acronym, email
- Shared with: GRCDC / Growing Room Child Development Centers

## Email-only suspected matches (manual review only)

### 1. ACC · Anderdon Child Care Inc

- Candidate: cus_KWF36nQBU2CDzK · Bridget Reid · $227.00 · active
- Signals: email
- Profile email: bridgetreid6@gmail.com
- Stripe email: bridgetreid6@gmail.com

### 2. AFYA · Academy for Young Achievers

- Candidate: cus_LxIvsCtyY09YHy · Tori Wallace · $197.00 · active
- Signals: email
- Profile email: academyforyoungachievers@gmail.com
- Stripe email: academyforyoungachievers@gmail.com

### 3. AKW · A Kid's World

- Candidate: cus_JXbLoE4RMr0v0F · akwchildcare.com · $1,201.33 · active
- Signals: email
- Profile email: shannonSmith@akwchildcare.com
- Stripe email: ShannonSmith@akwchildcare.com

### 4. APC · Apple Tree Prep Covington

- Candidate: cus_JXbLoE4RMr0v0F · akwchildcare.com · $1,201.33 · active
- Signals: email
- Profile email: ShannonSmith@akwchildcare.com
- Stripe email: ShannonSmith@akwchildcare.com

### 5. BCDC · Bedford Child Development Center

- Candidate: cus_K8YRXe8vzvhGpe · Cynthia Maher · $197.00 · active
- Signals: email
- Profile email: bedfordchildcare@hotmail.com
- Stripe email: bedfordchildcare@hotmail.com

### 6. CBG · Crossing Borders Language Center, LLC

- Candidate: cus_TOqwelOnvSvBvk · Chad Taylor · $1,395.00 · active
- Signals: email
- Profile email: elviataylor@crossingbordersgroup.com
- Stripe email: elviataylor@crossingbordersgroup.com

### 7. CCDC · Chico Child Development Center

- Candidate: cus_KxdU9HR5vk4azF · Shelly Caperello · $902.00 · active
- Signals: email
- Profile email: shellycaperello@icloud.com
- Stripe email: shellycaperello@icloud.com

### 8. CCLC · Children's Classic Learning Centers

- Candidate: cus_NjjZOs7MKfSpfl · Discovery Kidzone (DKZ) · $317.00 · active
- Signals: email
- Profile email: rachel@discoverykidzone.com
- Stripe email: rachel@discoverykidzone.com

### 9. GFC · Gallop's Family Center

- Candidate: cus_OpbAzzJfJeeHZb · Kristal Franklin · $197.00 · active
- Signals: email
- Profile email: skatemom2811@gmail.com
- Stripe email: skatemom2811@gmail.com

### 10. KPCC · Kindergrove

- Candidate: cus_Rig8Exm0qgIvG0 · Olive Grove Nature School · $995.00 · active
- Signals: email
- Profile email: skeith@kindergrove.org
- Stripe email: skeith@kindergrove.org

### 11. LBLC · Love Bug Learning Care

- Candidate: cus_SjdN4Pt8z4yMyC · Shunnarah Hayes · $395.00 · active
- Signals: email
- Profile email: lovebuglearningbugs@gmail.com
- Stripe email: lovebuglearningbugs@gmail.com

### 12. LECDC · La Esperanza Child Development Center, LLC

- Candidate: cus_OqcKq4FgANhyYe · Ruth Porta · $394.00 · active
- Signals: email
- Profile email: ruthporta@laesperanzapreschool.com
- Stripe email: ruthporta@laesperanzapreschool.com

### 13. LLCS · The Little Lamb Christian School

- Candidate: cus_JZ5yHbbo4gux94 · Deborah Duke · $1,712.00 · active
- Signals: email
- Profile email: debduke63@gmail.com
- Stripe email: debduke63@gmail.com

### 14. LOLA · Lotts of Learning Academy at Sierra Vista

- Candidate: cus_SODXF2zBF54qec · Alphabet Zone Childcare Company (AZCC) · $997.00 · active
- Signals: email
- Profile email: lottsoflearningacademysv@gmail.com
- Stripe email: lottsoflearningacademysv@gmail.com

### 15. PACC · Pasadena Childcare and Center

- Candidate: cus_SHVPSBQs86lB8m · Excellent Start Learning Center (ESLC) · $997.00 · active
- Signals: email
- Profile email: amuddesser@gmail.com
- Stripe email: amuddesser@gmail.com

### 16. TGL · Top Grade Learing

- Candidate: cus_U2TLqCpgG1nxGE · Top Grade Learning · $2,240.00 · active
- Signals: email
- Profile email: jigneshu2004@yahoo.com
- Stripe email: jigneshu2004@yahoo.com

### 17. UKC · Unique Kids Childcare

- Candidate: cus_OAJ5z1rwBTd4Mz · Dominique Gill · $197.00 · active
- Signals: email
- Profile email: kayanddee18@gmail.com
- Stripe email: kayanddee18@gmail.com

### 18. WAC · Winnford Academy

- Candidate: cus_S4RWKndPSD7zMa · Joshua Potters · $207.00 · past_due
- Signals: email
- Profile email: jpotters@winnfordacademy.com
- Stripe email: jpotters@winnfordacademy.com

### 19. NCUMP · Newport Center United Methodist Preschool

- Candidate: cus_UE5Pyw1mIH9e3E · Sandra Tolmasoff · $145.83 · active
- Signals: email
- Profile email: sandra@ncump.org
- Stripe email: sandra@ncump.org

### 20. TLCCDC · Tender Love & Care Child Development Center

- Candidate: cus_UFy29HNa556leM · Atoya Wilson · $599.00 · active
- Signals: email
- Profile email: tlccdc123@gmail.com
- Stripe email: tlccdc123@gmail.com

### 21. KZCP · Kids Zone Childcare & Preschool

- Candidate: cus_UIaLAl1xQhM5M6 · Melea Rogers · $996.00 · active
- Signals: email
- Profile email: kidszonechildcare@hotmail.com
- Stripe email: kidszonechildcare@hotmail.com

### 22. KKPS · Kid Krazy Preschool

- Candidate: cus_ULcTKxaawpQqzt · Melissa Chin · $1,449.00 · active
- Signals: email
- Profile email: info@kidkrazypreschool.com
- Stripe email: info@kidkrazypreschool.com

## Mixed / multi-candidate review queue

### 1. EA · EduCare Learning Center

- Candidate: cus_SEqWLGOpgMtVQz · Bright Beginnings Preschool (BBP) · $395.00 · signals: email
- Candidate: cus_SEqX9tIvMMJ8p8 · Bright Beginnings Preschool (BBP) · $395.00 · signals: email

## Legacy live Stripe rows with zero Stripe MRR

### 1. AA · Adventure Academy

- Legacy Stripe: cus_JXyaqcD57Hpiz4 · active

### 2. ACA · American Care Academy

- Legacy Stripe: cus_JbEMzoXeYue0Lo · active

### 3. ACAC · Academic Academy

- Legacy Stripe: cus_RtY1ZPpvHTKr57 · active

### 4. ACGP · A Child's Galaxy Preschool, Inc.

- Legacy Stripe: cus_JdaiwcQsLnZrJ8 · active

### 5. ACH · A Child’s Heart

- Legacy Stripe: cus_Mbm0j0R6YSBnjH · active

### 6. ACP · Apple Creek Preschool

- Legacy Stripe: cus_JXyaiESiplCveS · active

### 7. AITF · All in the Family Early Learning Center, LLC

- Legacy Stripe: cus_QZrpUYMjIk0d3B · active

### 8. AJT · Anna & Jack's Treehouse Learning Centers

- Legacy Stripe: cus_MhFRUiHlo8tenH · active

### 9. AZBB · A to Z Building Blocks Early Care and Education

- Legacy Stripe: cus_JVjQARWlRayfnJ · active

### 10. BBC · Bright Beginnings Family Childcare

- Legacy Stripe: cus_MdE6FdESr5IcMM · active

### 11. BCD · Buford Child Development Center

- Legacy Stripe: cus_RqrZk6iqXC5TyD · active

### 12. BED · Bright & Early Discoveries Childcare Center

- Legacy Stripe: cus_OwdcfQw4J2umYG · active

### 13. BLC · Beginnings Learning Center

- Legacy Stripe: cus_JZ5ymERqAxYAZh · active

### 14. BSLA · Brilliant Starts Learning Academy

- Legacy Stripe: cus_JZ5yh5vRfSz6Dc · active

### 15. CCA · Children's Choice Academy

- Legacy Stripe: cus_PJVBwp8enjX9XF · active

### 16. CCC · Caterpillar Corner Childcare

- Legacy Stripe: cus_PTE07GZHQoPU0y · active

### 17. CCCA · ChooChoo Chicago Academy

- Legacy Stripe: cus_PJVBwp8enjX9XF · active

### 18. CG · THE CHILDREN'S GARDEN

- Legacy Stripe: cus_PrKjTnd6ZtIvvU · active

### 19. CK · Cedar Kids (Owatonna, MN)

- Legacy Stripe: cus_JacbovVXfzQnZU · active

### 20. COW · Care-O-World Early Learning Center

- Legacy Stripe: cus_LHgZlvpaa0gd9S · active

### 21. CP · Creative Play Preschool

- Legacy Stripe: cus_KmluP4g9CzTeZW · active

### 22. CPDS · Citrus Park Day School

- Legacy Stripe: cus_N8fE3E89ViLFfB · active

### 23. CTCC · Cradles to Crayons Childcare & Early Learning Center

- Legacy Stripe: cus_LBV06QLEj8RfZq · active

### 24. CWCP · Creative Wonders Childcare & Preschool

- Legacy Stripe: cus_KJvK6kOwO8Urpz · active

### 25. DTA · Discovery Tree Academy

- Legacy Stripe: cus_L5uTXs8bL2u65h · active

### 26. EBCCC · Enlightened Beginnings Child Care Centre

- Legacy Stripe: cus_JUyxIXqCY96Fgr · active

### 27. ELA · Enriched Learning Academy

- Legacy Stripe: cus_QEZmAF1JuFaCem · active

### 28. FDCA · First Discovery Children's Academy

- Legacy Stripe: cus_JWTZM66NZ3U1fw · active

### 29. FSCP · Future Scholars Childcare & Preschool

- Legacy Stripe: cus_Jc5ZZ7QUIUd9r8 · active

### 30. GMS · Greater Montessori School

- Legacy Stripe: cus_MwesQIrM2BZ3xD · active

### 31. HALC · Heavenly Arms Learning Center

- Legacy Stripe: cus_JUDjNelnh97lEy · active

### 32. HHA · Humble Hearts Academy

- Legacy Stripe: cus_JWTZBDeKTWdXPs · active

### 33. HKA · Healthy Kids Academy

- Legacy Stripe: cus_NH5hlUMmk5pMcB · active

### 34. HP · Heritage Preschools

- Legacy Stripe: cus_OSkTrR4KS8Nmpp · active

### 35. HWG · Here We Grow Early Learning Center

- Legacy Stripe: cus_KuGFkTb1Q5wfuo · active

### 36. IBI · Inch by Inch ChildCare

- Legacy Stripe: cus_MZ6qp9w0SyhvYG · active

### 37. IPA · International Preparatory Academy

- Legacy Stripe: cus_PdmSmL3lXY47mP · active

### 38. IYCCC · Impressionable Years Child Care Center

- Legacy Stripe: cus_JcT1JFBqL0Zl0F · active

### 39. JHCC · Joyful Hearts Childcare

- Legacy Stripe: cus_K3RckpGXuuZ8tW · active

### 40. JSELC · Jump Start Early Learning Center & Quality Child Care

- Legacy Stripe: cus_NZhAnYvF8jMqcN · active

### 41. KC · Kangaroo Clubhouse

- Legacy Stripe: cus_LxG0JiS9qSdTVn · active

### 42. KGLA · A Kids Gym Learning Academy

- Legacy Stripe: cus_JcT18n4fM8F4r9 · active

### 43. KIDS · KIDS Early Learning Centers

- Legacy Stripe: cus_JUbjKgulUXKcL8 · active

### 44. KQA · Kings & Queens Academy Daycare Center

- Legacy Stripe: cus_OtIGK3ZB40NQBE · active

### 45. KWLCS · Kid's World Learning Center

- Legacy Stripe: cus_JZ5yS6mslG4IXP · active

### 46. LABC · Lylabugs and Buttons Childcare

- Legacy Stripe: cus_S2uA2968HaUUSO · active

### 47. LATX · Little Angels Learning Center

- Legacy Stripe: cus_JbiaO4ZQ8xdcfb · active

### 48. LLECC · Little Learner's Early Childhood Center

- Legacy Stripe: cus_MXzW7adiq00Toa · active

### 49. LPPH · Little People's Playhouse

- Legacy Stripe: cus_JWqoUscNyL7rgt · active

### 50. LSP · Little Scholars Preparatory School

- Legacy Stripe: cus_OwMhgrZM7v3KcZ · active

### 51. LT · Logan's Treehouse

- Legacy Stripe: cus_NBfIuSCpOykJ5O · active

### 52. LVA · Lil’ Voyagers Academy

- Legacy Stripe: cus_MiUSSIBbJWDBjR · active

### 53. MCCC · Mi Casa Child Centers

- Legacy Stripe: cus_MmFVv86PbbJj2B · active

### 54. MHC · Georgia’s Best 24 HR Childcare / Madalyn's House Childcare/Leap Learning Academy

- Legacy Stripe: cus_JWTa4sKbFb1j2B · active

### 55. MLC · Montessori Learning Center

- Legacy Stripe: cus_JVjQwHvjmm7I1d · past_due

### 56. MLT · My Learning Tree Preschool & Childcare

- Legacy Stripe: cus_JcT1ExweL5vsJU · active

### 57. MPM · Magnolia Progressive Montessori

- Legacy Stripe: cus_Pm2zNMjoj7EuGp · active

### 58. MVLC · My Village Learning Center

- Legacy Stripe: cus_JTqL0QprsTBfn8 · active

### 59. MWS · Montessori World School

- Legacy Stripe: cus_KXRFiZCcTh3SmK · active

### 60. PCLA · Preschool Connection Learning Academy

- Legacy Stripe: cus_OAKfn1XyR52c64 · active

### 61. PD · Pancheri Discovery Center

- Legacy Stripe: cus_KceeMBLO8OCLdJ · active

### 62. PM · Parker Montessori

- Legacy Stripe: cus_OB8936VE6Itkwa · active

### 63. PPELC · Paper Planes Early Learning Center

- Legacy Stripe: cus_MayuSwPf1aZGng · active

### 64. RGELC · Rising Generations Early Learning Center

- Legacy Stripe: cus_JWqoA66B7xl3Yf · active

### 65. SEEC · Sprout Early Education Center

- Legacy Stripe: cus_JVMBfKyjZQjGBy · past_due

### 66. SELC · Shell's Early Learning Centers

- Legacy Stripe: cus_JWTamoKJ5bUec5 · active

### 67. SSG · Small Steps Childcare & Early Learning Center

- Legacy Stripe: cus_Or1LuuPCpgB8SZ · active

### 68. SUG · See Us Grow Childcare and Learning Center

- Legacy Stripe: cus_JUDjKBe7BrA0HY · active

### 69. TATLC · The Apple Tree Learning Centers

- Legacy Stripe: cus_Mc4OlIGKcM9RJx · active

### 70. TEN · The Enrichment Nest

- Legacy Stripe: cus_Pg0wH9HsAZ27SN · active

### 71. TEYP · The Early Years Preschool

- Legacy Stripe: cus_R05HCmthylsB8m · active

### 72. TFA · Tiny Footprints Academy

- Legacy Stripe: cus_Pp3POuGkehVgM3 · past_due

### 73. TKC · The Kids Connection

- Legacy Stripe: cus_LxIvLxlyaXzYv9 · active

### 74. TSI · The Sitter, Inc

- Legacy Stripe: cus_RGZNaNw3frPG9z · active

### 75. TTKLC · Tiny Treasure Kids

- Legacy Stripe: cus_MhMokOUIeG5q8Z · active

### 76. WLC · Wellborn Learning Center

- Legacy Stripe: cus_MjWx2DMiZqvAAr · past_due

### 77. WOK · World of Knowledge Child Development Center

- Legacy Stripe: cus_Jvir3rTljngpQR · active

### 78. LF · Little Farmers Learning Center

- Legacy Stripe: cus_U5vS5kaGn1WovW · active

### 79. (no acronym) · Naomi Fox

- Legacy Stripe: cus_QP2UESDwZhzmMs · active

### 80. (no acronym) · Morgan Palmer

- Legacy Stripe: cus_OqKZQ00IDiCwE2 · active

### 81. (no acronym) · Luv em & Leave em

- Legacy Stripe: cus_R2IP98EIj9CQOq · active

### 82. (no acronym) · Dogwood Lane Children's Academy

- Legacy Stripe: cus_O0dJfleBWJOQRB · active

### 83. (no acronym) · Daniel Essien

- Legacy Stripe: cus_MzkEcNwHhFgmUv · active

### 84. (no acronym) · codkids1.com

- Legacy Stripe: cus_KJYcNTN25uCMf1 · active

### 85. (no acronym) · Valerie Beck

- Legacy Stripe: cus_KxRsomujnYS3sC · active

### 86. (no acronym) · Little Leaders of KCK

- Legacy Stripe: cus_PLlUg1qCd3Xio6 · active

### 87. (no acronym) · LaFontaine Preparatory School

- Legacy Stripe: cus_PQjMEer5MPLaAJ · active

### 88. (no acronym) · firststepscenters.com

- Legacy Stripe: cus_JWqogvcQqGgq2K · active

### 89. (no acronym) · Whitney Burkman

- Legacy Stripe: cus_OHWAJDHu16p9NF · active

### 90. (no acronym) · Constance Sholar Cherry

- Legacy Stripe: cus_MOxonYFqrnyFlR · active

### 91. (no acronym) · Nathan Cole

- Legacy Stripe: cus_JcT10sejsKzfPH · active

### 92. (no acronym) · Darla Riley

- Legacy Stripe: cus_LSMLL9htQgsynO · active

### 93. (no acronym) · tameenah adams

- Legacy Stripe: cus_K0p2Xu8tjqhg3f · active

### 94. (no acronym) · Toshina Thames

- Legacy Stripe: cus_MgDx0DgoxWcl7I · active

### 95. (no acronym) · Raul Pineyro

- Legacy Stripe: cus_JqKgKTAVsvDlzf · active

### 96. (no acronym) · Ronesha Dotson

- Legacy Stripe: cus_JVv2LvIQPPA4Qt · active

## No live Stripe evidence

### 1. AN · Adventureland Nursery

- Legacy Stripe: (none)

### 2. AVAC · Avimor Academy

- Legacy Stripe: (none)

### 3. AZ · Premier Learning Academy (Chandler, AZ)

- Legacy Stripe: (none)

### 4. BFW · Bright Futures Westside

- Legacy Stripe: (none)

### 5. BOCC · Beautiful Oasis Childcare

- Legacy Stripe: (none)

### 6. BSC · Bright Start Early Care & Preschool (DC)

- Legacy Stripe: (none)

### 7. BSELA · Bright Scholars Early Learning Academy

- Legacy Stripe: (none)

### 8. C2C · Cradles 2 Crayons Early Learning Academy

- Legacy Stripe: (none)

### 9. CCP · Children's Choice Preschool

- Legacy Stripe: (none)

### 10. CCPS · Child Care Partners

- Legacy Stripe: (none)

### 11. CEDAT · CEDAT USA

- Legacy Stripe: (none)

### 12. CHA · Creative Home Academy and Preschool

- Legacy Stripe: (none)

### 13. COD · Children Of Destiny Learning Center

- Legacy Stripe: (none)

### 14. CRCLC · Capital Royal Childcare & Learning Center

- Legacy Stripe: (none)

### 15. CTA · Creative Times Academy

- Legacy Stripe: (none)

### 16. EBLC · East Bank Learning Center

- Legacy Stripe: (none)

### 17. FCDMA · Frederick Country Day Montessori & Art School

- Legacy Stripe: (none)

### 18. FDCS · The Fox's Den Childcare

- Legacy Stripe: (none)

### 19. GTK · Gifted and Talented Kid’s Academy, INC

- Legacy Stripe: (none)

### 20. ICCCC · Infinite Care Child Care Center

- Legacy Stripe: (none)

### 21. ISELC · Inspiration Station Early Learning Center

- Legacy Stripe: (none)

### 22. JEL · Jefferson Early Learning

- Legacy Stripe: (none)

### 23. JTC · Joyful Tots Childcare

- Legacy Stripe: (none)

### 24. KA-BVD · Kiddie Academy (LLC is: M Triple B, LLC) (KA-BVD)

- Legacy Stripe: (none)

### 25. KBLC · Kidbridge Learning Center

- Legacy Stripe: (none)

### 26. KFKA · Kids For Kids Academy

- Legacy Stripe: (none)

### 27. KICH · Kid Chemist

- Legacy Stripe: (none)

### 28. KLS · First Steps Learning Centers, Raising Stars Academy, Kid Scholars, State of Illinois Child Development Center, & Kandiland Schools

- Legacy Stripe: (none)

### 29. KPS · Kiddie Prep School

- Legacy Stripe: (none)

### 30. KRKPMC · Kids 'R' Kids Pelham Medical Center

- Legacy Stripe: (none)

### 31. LAFC · OakRidge Academy Suwannee & Alpharetta

- Legacy Stripe: (none)

### 32. LCM · LakeCreek Montessori School

- Legacy Stripe: (none)

### 33. LDEL · Little Duckling Early Learning Christian Academy

- Legacy Stripe: (none)

### 34. LLCD · Little Learners Child Development

- Legacy Stripe: (none)

### 35. LSAEE · The Lehigh School Academy of Early Education

- Legacy Stripe: (none)

### 36. LSD · Little Scholars Daycare

- Legacy Stripe: (none)

### 37. LSEP · Little Stars ELC of Pa

- Legacy Stripe: (none)

### 38. LTADP · Little Tiger Academy (LTADP) (Daycare & Preschool)

- Legacy Stripe: (none)

### 39. MACC · Magnolia Academy Childcare Center

- Legacy Stripe: (none)

### 40. NS · The Nature Schools

- Legacy Stripe: (none)

### 41. NSCC · New Salem Children's Center

- Legacy Stripe: (none)

### 42. PFCC · Pooh & Friends Child Care Development Center II

- Legacy Stripe: (none)

### 43. PICEC · Playpourri International Care & Educational Center

- Legacy Stripe: (none)

### 44. PKP · Pre-K & Play Academy

- Legacy Stripe: (none)

### 45. PLKC · Pearland Kids Club

- Legacy Stripe: (none)

### 46. PP · Playmates Preschool

- Legacy Stripe: (none)

### 47. RC · Rainbow Connection

- Legacy Stripe: (none)

### 48. SKL · Sunny Kids Land LLC

- Legacy Stripe: (none)

### 49. SSCP · Sulphur Springs Preschool

- Legacy Stripe: (none)

### 50. SST · Smart Steps Inc

- Legacy Stripe: (none)

### 51. TGTP · The Giving Tree Preschool

- Legacy Stripe: (none)

### 52. TLA · Tree of Life Academy

- Legacy Stripe: (none)

### 53. TLB · The Learning Bee

- Legacy Stripe: (none)

### 54. TLE-JW · The Learning Experience (TLE-JW) Sundance Kids, LLC

- Legacy Stripe: (none)

### 55. TRCC · Triple R Child Care

- Legacy Stripe: (none)

### 56. UKELC · University Kids Early Learning Center

- Legacy Stripe: (none)

### 57. VMA · Virginia Montessori Academy

- Legacy Stripe: (none)

### 58. WALP · Wonder Academy

- Legacy Stripe: (none)

### 59. WBLC · Willowbrook Learning Center

- Legacy Stripe: (none)

### 60. WCDC · Waterbabies Child Development Center

- Legacy Stripe: (none)

### 61. CCCS · Coral Community Charter School

- Legacy Stripe: (none)

### 62. TRYCC · The Riley Youth Community Center

- Legacy Stripe: (none)

### 63. KA-SM · Kiddie Academy of Twinsburg

- Legacy Stripe: (none)

### 64. GCP · The Garden Community Preschool

- Legacy Stripe: (none)

