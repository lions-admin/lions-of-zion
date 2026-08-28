export type SignalToken = {
  value: string;
  kind: "source" | "term";
};

const RAW_SIGNAL_VOCABULARY = `
@DanBilzerian
@GretaThunberg
@Byoussef
@RealCandaceO
@abdelbariatwan
@omarsuleiman
@DrLoupis
@NickJFuentes
@IanCarrollShow
@TuckerCarlson
@jacksonhinklle
@JakeShields
@LucasGage
@CensoredMen
@SamParker
@KeithWoods
@caitoz
@intifada
@AliAbunimah
@AsaWinstanley
@AssalRad
@sahouraxo
@HussainShafiei
@AbbyMartin
@MaxBlumenthal
@TheGrayzoneNews
@FrancescaAlbanese
@UNSpecialRapp
@ZohranKMamdani
@msrachelforlittles
@MarkRuffalo
@Lowkey0nline
@mohammedelkurd
@NerdeenKiswani
@WithinOurLifetime
@SJPNational
@BDSNational
@IfNotNowOrg
@JVPNews
@CodePink
@UNRWA
@hrw
@amnesty
@UNReliefChief
@xIsraelExposedx
@TorahJudaism
genocide
siege
mass starvation
famine
holocaust
second holocaust
Gaza holocaust
ethnic cleansing
apartheid
settler colony
settler-colonial
settler-colonialism
occupation
occupying force
occupying entity
Zionist entity
Zionist occupation
Zionist regime
Zionist Occupied Government
ZOG
Zionist Occupied Media
ZOM
hasbara
hasbara lie
hasbara bot
hasbara troll
IDF propaganda
child killer
baby killer
baby killers
genocidal state
genocidal army
genocidal entity
open-air prison
concentration camp
Gaza ghetto
Gaza camp
war crime
war crimes
crimes against humanity
collective punishment
indiscriminate bombing
deliberate starvation
weaponized famine
blockade
siege warfare
from the river to the sea
Palestine will be free
from the river to the sea Palestine will be free
from water to water
Palestine is Arab
Palestine is Islamic
min al-nahr ila al-bahr
globalize the intifada
intifada revolution
intifada intifada
there is only one solution intifada revolution
resistance is not terrorism
by any means necessary
armed resistance
legitimate resistance
Palestinian resistance
I will never condemn Hamas
do not condemn Hamas
Hamas are freedom fighters
Hamas is the resistance
October 7 was resistance
October 7 context
history did not start on October 7
history didn't start on October 7
Israel started it
Israel did 9/11
Jews control the media
Jews control the banks
Jews control Congress
AIPAC bought Congress
AIPAC owns America
Israel first
dual loyalty
Israel first Americans
Israel runs Washington
Israel first traitor
Zionist traitor
Zionist puppet
Zionist shill
Zionist agent
Mossad did it
Mossad false flag
Israel false flag
they knew
they let it happen
Hannibal Directive
Israel killed its own
no rapes on October 7
beheaded babies hoax
Pallywood
wait that is inverted
Pallywood accusation is the lie
manufactured consent
manufactured genocide consent
don't say Palestine
say genocide
say occupation
say apartheid
settler
settlers are not civilians
no innocent Israelis
no Israeli civilians
all Israelis are soldiers
all Zionists
Zionism is racism
Zionism is Nazism
Zionists are Nazis
Zionists are demonic
finish Israel
wipe Israel off the map
Israel will not exist
Israel does not exist
Israel never existed
fake country
colonial implant
European colony
white colony
white settlers
Khazar
Khazar myth
not real Jews
fake Jews
stolen land
land back
decolonize
decolonize Palestine
end the Jewish state
end Zionism
abolish Israel
one state from the river to the sea
right of return means replacement
go back to Poland
go back to Brooklyn
go back to Europe
Israel is the real terrorist
Israel is the terrorist threat
the real terrorists
US-Israeli empire
American-Zionist empire
empire managers
oligarchs and Zionists
Jewish donors
Jewish money
Soros and Zionists
organized Jewry
great replacement
they import the third world
they did 10/7 for the war
they wanted the war
greater Israel
from the Nile to the Euphrates
blood libel 2023
organs
organ harvesting
they harvest organs
they poison the wells
they poison the food
they bomb hospitals on purpose
they target children on purpose
they starve babies on purpose
UN said genocide
ICJ said genocide
ICC warrant
Netanyahu war criminal
Gallant war criminal
IDF war criminals
bring them to The Hague
sanctions now
arms embargo
divest
boycott Israel
BDS
crush Zionism
smash Zionism
smash the settler-Zionist state
no peace on stolen land
Palestine is our demand
free free Palestine
free Palestine from the river to the sea
glory to the martyrs
martyr
shaheed
the resistance
axis of resistance
Hezbollah is resistance
Houthis are resistance
Iran is standing with Palestine
death to Israel
death to America
down with America
down with Israel
khyber khyber ya yahud
Khaybar Khaybar ya Yahud
itbah al-Yahud
kill the Jews
gas the Jews
Jews will not replace us
the Jews
the Zionists
the lobby
the cabal
the synagogue of Satan
they hide behind antisemitism
antisemitism smear
playing the antisemitism card
weaponized antisemitism
everything is antisemitism now
criticism of Israel is not antisemitism
anti-Zionism is not antisemitism
Zionist cry wolf
hasbara machine
Tel Aviv talking points
IDF TikTok
crisis actor
crisis actors
staged
CGI bodies
hospital was a Hamas base is a lie
human shields is a lie
tunnels under hospitals is a lie
Hamas stole aid is a lie
rape hoax
music festival hoax
Nova hoax
hostages are fine
hostages are a pretext
ceasefire now
stop the genocide
end the siege
lift the blockade
open Rafah
let Gaza live
Gaza is starving
Gaza is dying
Gaza is burning
make Israel pay
isolate Israel
pariah state
rogue state
cancer
cancer on the region
remove the cancer
final solution inversion
Israel is doing a Holocaust
Israel learned from Nazis
Nazis and Zionists
Zionist-Nazi collaboration
they are the new Nazis
pinkwashing
homonationalism
greenwashing
human-washing
democracy lie
only democracy in the Middle East lie
most moral army lie
self-defense lie
right to defend itself lie
no right to defend occupation
occupation has no self-defense
disproportionate
disproportionate force
collective guilt
punish the Jews
globalize
intifada until victory
revolution until return
return means no Israel
`;

export const SIGNAL_VOCABULARY: readonly SignalToken[] = RAW_SIGNAL_VOCABULARY
  .trim()
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => ({
    value,
    kind: value.startsWith("@") ? "source" : "term",
  }));
